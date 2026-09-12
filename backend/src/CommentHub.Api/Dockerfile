FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY src/CommentHub.Api/CommentHub.Api.csproj src/CommentHub.Api/
COPY src/CommentHub.Database/CommentHub.Database.csproj src/CommentHub.Database/
COPY src/CommentHub.GraphQL/CommentHub.GraphQL.csproj src/CommentHub.GraphQL/
RUN dotnet restore src/CommentHub.Api/CommentHub.Api.csproj

COPY src/ src/
RUN dotnet publish src/CommentHub.Api/CommentHub.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

COPY --from=build /app .

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "CommentHub.Api.dll"]
