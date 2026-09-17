# Morning-of defense startup

Run everything on **one PC** on the **demo Wi-Fi**. Phones and this PC must share that LAN. Do not use `localhost` as the API URL on a physical phone.

## Ports

| Service | Port | URL |
|---|---|---|
| MySQL (XAMPP) | 3306 | local only |
| Hiraya.Api | **5188** | `http://0.0.0.0:5188` |
| Website (Next.js) | **3000** | `http://127.0.0.1:3000` |
| Desktop (Vite + Electron) | **5173** | desktop window |
| Expo / Metro | **8081** | QR in the Expo terminal |

## Order (cold start)

1. Start **XAMPP MySQL**. Confirm `hiraya_learning_center` exists.
2. In the repo root (`Hiraya play Center React`):

```powershell
npm run dev:api
```

Wait until you can open `http://127.0.0.1:5188/api/health` and see `ok`.

3. New terminal:

```powershell
npm start
```

Open `http://127.0.0.1:3000`. Admin login: `admin` / `Admin123`.

4. If port **5173** is stuck:

```powershell
netstat -ano | findstr :5173
taskkill /PID <pid> /F
```

Then:

```powershell
npm run dev:desktop
```

Confirm **Student management**, **Here today**, and **COE download**.

5. Mobile (physical phone, same Wi-Fi):

```powershell
npm run dev:mobile
```

Expo should print a LAN QR. Scan with **Expo Go**.

- Leave `apps/mobile/.env` **unset** so the app uses the Metro LAN IP automatically, **or** set `EXPO_PUBLIC_API_URL=http://<THIS-PC-LAN-IP>:5188`.
- Never use `http://127.0.0.1:5188` on a real phone.

6. Optional demo data (after API is up):

```powershell
node scripts/defense-seed.mjs
```

This fills center contact if empty, links demo children to a parent account, and adds a few learning modules if the list is empty.

## Demo logins

| Role | Username | Password | Where |
|---|---|---|---|
| Super Admin (Mariel) | `admin` | `Admin123` | Website `/admin`, Desktop |
| Teacher | `teacher` | `Teacher123` | Expo Go |
| Parent | `parent` | `Parent123` | Expo Go |

**Do not demo** Super Admin profile save or Parent Edit Family on stage unless you already saved twice successfully that morning. Use Admin → Parents if family contact must be shown.

## Quick checks (5 minutes)

- Public home Contact shows address, phone, email.
- Admin lists (students / parents / teachers) load without a “none found” flash.
- Parent mobile Home shows the **child** (name / initial), not the parent photo.
- Website footer is not covered by “Start enrollment”.
- No “Website under Development” banner (`NEXT_PUBLIC_SHOW_DEV_BANNER` must stay unset).
