FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY src/BuildingBlocks/BookingPlatform.Common/ /BuildingBlocks/BookingPlatform.Common/
COPY src/Services/SeatService/ SeatService/
RUN dotnet restore SeatService/SeatService.csproj
RUN dotnet publish SeatService/SeatService.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app .
EXPOSE 80
ENTRYPOINT ["dotnet", "SeatService.dll"]
