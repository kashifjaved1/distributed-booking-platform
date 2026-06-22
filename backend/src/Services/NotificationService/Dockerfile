FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY src/BuildingBlocks/BookingPlatform.Common/ /BuildingBlocks/BookingPlatform.Common/
COPY src/Services/NotificationService/ NotificationService/
RUN dotnet restore NotificationService/NotificationService.csproj
RUN dotnet publish NotificationService/NotificationService.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app .
EXPOSE 80
ENTRYPOINT ["dotnet", "NotificationService.dll"]
