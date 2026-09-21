FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY backend/Hiraya.Shared/Hiraya.Shared.csproj backend/Hiraya.Shared/
COPY backend/Hiraya.Data/Hiraya.Data.csproj backend/Hiraya.Data/
COPY backend/Hiraya.Api/Hiraya.Api.csproj backend/Hiraya.Api/
RUN dotnet restore backend/Hiraya.Api/Hiraya.Api.csproj
COPY backend/ backend/
RUN dotnet publish backend/Hiraya.Api/Hiraya.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_URLS=http://0.0.0.0:8080
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
ENTRYPOINT ["dotnet", "Hiraya.Api.dll"]
