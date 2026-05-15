FROM mcr.microsoft.com/dotnet/runtime-deps:10.0
ARG TARGETARCH
WORKDIR /app
COPY publish/linux-${TARGETARCH}/ ./
EXPOSE 8081
ENTRYPOINT ["./Portfolio"]
