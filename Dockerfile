# HTML2APK — Dockerfile
# Installs Node, a JDK, and the Android SDK command-line tools so Bubblewrap
# can build signed TWA APKs inside the container. Works on Railway, Render,
# Fly.io, or any other host that runs a Dockerfile.

FROM eclipse-temurin:17-jdk-jammy

ENV DEBIAN_FRONTEND=noninteractive \
    ANDROID_HOME=/opt/android-sdk \
    ANDROID_SDK_ROOT=/opt/android-sdk \
    NODE_VERSION=22.x

# --- System deps + Node.js ---------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates unzip git \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# --- Android SDK command-line tools --------------------------------------
# https://developer.android.com/studio#command-line-tools-only
RUN mkdir -p ${ANDROID_HOME}/cmdline-tools \
    && curl -fsSL -o /tmp/cmdline-tools.zip \
      https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip \
    && unzip -q /tmp/cmdline-tools.zip -d ${ANDROID_HOME}/cmdline-tools \
    && mv ${ANDROID_HOME}/cmdline-tools/cmdline-tools ${ANDROID_HOME}/cmdline-tools/latest \
    && rm /tmp/cmdline-tools.zip

ENV PATH=${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools:${PATH}

# Accept licenses non-interactively, then install the packages Bubblewrap needs.
RUN yes | sdkmanager --licenses > /dev/null \
    && sdkmanager --install \
      "platform-tools" \
      "platforms;android-34" \
      "build-tools;34.0.0" \
      > /dev/null

# Cap Gradle's memory use and disable the background daemon — a daemon left
# running between builds eats RAM for no benefit in a one-shot container,
# and uncapped heap sizes are what gets this process OOM-killed on small
# memory plans.
RUN mkdir -p /root/.gradle && \
    printf "org.gradle.daemon=false\norg.gradle.jvmargs=-Xmx768m -XX:MaxMetaspaceSize=256m\norg.gradle.parallel=false\n" \
      > /root/.gradle/gradle.properties

# --- App ------------------------------------------------------------------
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY server ./server
COPY public ./public

RUN mkdir -p workdir builds

EXPOSE 3000
CMD ["node", "server/index.js"]
