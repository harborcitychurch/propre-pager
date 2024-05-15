FROM alpine:3.19

ARG VCS_REF
ARG BUILD_DATE
ARG VERSION

LABEL maintainer: "bluedog8050@hotmail.com"
LABEL org.label-schema.schema-version: "1.0"
LABEL org.label-schema.version: ${VERSION}
LABEL org.label-schema.name: "proprepager"
LABEL org.label-schema.description: "An automated pager relay for ProPresenter 7 for use in church childcare."
LABEL org.label-schema.vcs-url: "https://github.com/bluedog8050/ProPrePager"
LABEL org.label-schema.vcs-ref: ${VCS_REF}
LABEL org.label-schema.build-date: ${BUILD_DATE}
LABEL org.label-schema.docker.cmd: "docker run -d -P -v ./data:/app/data bluedog8050/proprepager"

WORKDIR /app

COPY ./pager.py ./
COPY ./requirements.txt ./
COPY ./.env ./

RUN apk update && apk upgrade

RUN apk add --no-cache python3

EXPOSE 80/tcp
EXPOSE 443/tcp

CMD ["python3", "pager.py"]