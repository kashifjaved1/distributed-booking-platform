FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY src/BuildingBlocks/BookingPlatform.Common/ /BuildingBlocks/BookingPlatform.Common/
COPY src/Services/BookingService/ BookingService/

RUN dotnet restore BookingService/BookingService.csproj
RUN dotnet publish BookingService/BookingService.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app .
EXPOSE 80 443
ENTRYPOINT ["dotnet", "BookingService.dll"]
