FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY src/BuildingBlocks/BookingPlatform.Common/ /BuildingBlocks/BookingPlatform.Common/
COPY src/Services/TicketService/ TicketService/
RUN dotnet restore TicketService/TicketService.csproj
RUN dotnet publish TicketService/TicketService.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app .
EXPOSE 80
ENTRYPOINT ["dotnet", "TicketService.dll"]
