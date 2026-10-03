# RION payment logic audit

## Formula

```
TUITION FEE
-
TOTAL APPROVED / VALID PAYMENTS
=
REMAINING BALANCE
```

A down payment is the first valid payment. It is included once in total paid. It is not subtracted again.

```
remainingBalance = tuitionFee - totalPaid
```

Status is derived from those amounts:

- `totalPaid <= 0` → unpaid
- `0 < totalPaid < tuitionFee` → partial
- `totalPaid >= tuitionFee` → paid

Cancelled, rejected, failed, refunded, void, waived, and pending payments are not included in total paid.

Money is rounded to 2 decimal places. The client uses cent rounding. The API uses `decimal` with `MidpointRounding.AwayFromZero`. The database column is `decimal(18,2)`.

## Existing logic found

Payments already lived on `Payment` rows (`amount`, `amountPaid`, `paymentStatus`, method, reference, notes, dates, history). Student totals lived on `StudentOps` (`feeAmount`, `laceAmount`, `paymentStatus`). There was no separate tuition ledger.

The old client formula in `studentPaymentBalance` added up `amount - amountPaid` on each open charge. When no charge existed it used `feeAmount + laceAmount`. Saving a balance wrote that remaining amount back into `feeAmount` and rewrote the latest charge so `amount = amount already paid + remaining`. The next payment was then subtracted from the remaining, not from the original tuition. A down payment could be removed twice.

`PaymentService.Remaining` used the same per-row `amount - amountPaid` rule. Reports summed those row remainders, and a paid row with `amountPaid = 0` could still count `amount` as collected.

Teacher salary rows are marked `enrollmentId = "teacher"` and are not part of student tuition.

## Problems discovered

- Remaining balance was stored as if it were the tuition fee.
- A later payment reduced the stored remainder instead of the original fee.
- Down payment and total paid could both be subtracted.
- Payment status could be typed by hand and did not have to match the money.
- Dashboard and report totals could include cancelled rows or treat a charge amount as cash collected.
- The add-charge form created a payment row whose amount was described as the remaining balance.

## New calculation

`tuitionFee` is the amount the student must pay. If `StudentOps.tuitionFee` is set, that value is used. Older rows that only have `feeAmount`, or a charge whose `amount` is larger than `amountPaid`, are read once so existing balances are not wiped. The first new payment, edit, or cancellation copies that recovered fee onto `tuitionFee` so a later edit cannot shrink the fee.

`totalPaid` is the sum of `amountPaid` on that student's payments, excluding teacher salary and excluded statuses.

`remainingBalance = max(0, tuitionFee - totalPaid)`.

The website, Electron app, and mobile app display the result. They do not send `totalPaid`, `remainingBalance`, or `paymentStatus` as the source of truth. Store saves run `StudentTuition.Enforce`, which recalculates status and rejects a payment that would pass the remaining balance, or a tuition fee set below money already paid.

## Database changes

- `student_ops.TuitionFee` `decimal(18,2) NOT NULL DEFAULT 0`, added on API startup with `TryAddColumn`. Existing rows stay. No production connection and no data delete.
- `feeAmount` remains. When a tuition fee is saved, both fields are set to that fee so the old remainder is not reused.
- `laceAmount` is uniform/lace inventory. It is not part of this formula.
- Payment history stays on the existing `payments` rows.

## API changes

- `StudentTuition` is the server copy of the formula.
- `StoreSanitizer` calls `StudentTuition.Enforce` on admin and staff store saves, inside the existing save path.
- Parent balance mail uses `StudentTuition.Remaining`.
- Family home open balance is the sum of each child's remaining balance.
- Operations report billed, collected, and open amounts are tuition, total paid, and remaining balance for the visible students.
- A collection through `PaymentService.CollectAsync` cannot exceed the student's remaining balance. Teacher salary still uses its own row.

## Frontend changes

- Admin payments show Tuition fee, Total paid, Remaining balance, and derived status.
- The remaining-balance window edits the tuition fee and shows total paid and remaining as read-only.
- Amount received appends a payment. The first valid payment is labeled Down payment. Later ones are Partial payment.
- Edit and Cancel recalculate the summary. The cancelled row stays in history.
- Overpayment shows: `Payment amount cannot exceed the remaining balance of ₱500.00.`
- Dashboard Total paid and Outstanding balance, and the report CSV, use the same totals. Cancelled and pending payments are excluded. Teacher salary is excluded.
- The old add-charge form now saves a tuition fee. It does not create a second balance.

## Electron changes

The desktop payments desk, student form, and reports use the same helpers as the website. Student save keeps `tuitionFee` on the operations row. Teacher payments still have no Received by field.

## Mobile changes

The family payments screen shows the selected child's tuition fee, total paid, remaining balance, derived status, and payment history with the payment type. There is still no in-app payment gateway.

## Validation rules

- Payment amount must be greater than 0.
- A tuition fee must be set before a payment is recorded.
- Payment amount cannot exceed the remaining balance.
- Tuition fee cannot be set below the amount already paid.
- A parent/student payment requires Received by.
- Only paid, partial, overdue, and other non-excluded statuses count. Pending does not count until it is recorded as received.
- Rejected, cancelled, failed, refunded, void, and waived payments stay in history and do not count.

## Test cases

| Case | Input | Expected |
| --- | --- | --- |
| 1 | Tuition 5000, paid 0 | Remaining 5000, unpaid |
| 2 | Down payment 1000 | Total paid 1000, remaining 4000, partial |
| 3 | 1000 then 500 | Total paid 1500, remaining 3500, partial |
| 4 | 1000 + 500 + 3500 | Total paid 5000, remaining 0, paid |
| 5 | 4500 paid, then 1000 | Rejected. Message names the ₱500.00 balance |
| 6 | Cancel the only 1000 payment | Total paid 0, remaining 5000, unpaid. Row kept |
| 7 | Edit 500 to 1000 after a 1000 payment | Total paid 2000, remaining 3000, partial |

## Test results

`node --experimental-strip-types --import ./payment-logic-loader.mjs --test payment-logic.test.mjs`

7 passed, 0 failed.

The live API was rebuilt after this change so `TuitionFee` is added on the local database at startup. No deployment was made.

## Remaining issues

- Lace / uniform amounts stay on the inventory screen and are not part of tuition.
- A payment left as pending does not count until it is recorded as received.
- The mobile app can show the balance. It cannot collect a payment.
- Browser walkthrough of the admin screens was not repeated in this pass. The formula is covered by the seven automated cases and by the API check on every store save.
