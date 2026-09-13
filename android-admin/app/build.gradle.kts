// RYVEN DEPT — private admin app.
//
// PRIVATE DISTRIBUTION: this app is for the store owner/admin only.
// It contains NO server secrets — only the public storefront API base URL.
// All authorization is enforced by the existing backend (session + CSRF).
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val apiBaseUrl: String =
    (project.findProperty("ryvenApiBaseUrl") as String?)
        ?: "https://ryven-com-ten.vercel.app"

android {
    namespace = "com.ryvendept.admin"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.ryvendept.admin"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
        // Public configuration only — the storefront base URL. Never put
        // secrets (ADMIN_SECRET, DATABASE_URL, FCM keys, Meta tokens) here.
        buildConfigField("String", "API_BASE_URL", "\"${apiBaseUrl.trimEnd('/')}\"")
    }

    buildTypes {
        debug {
            // Debug builds are directly installable for private distribution.
            isMinifyEnabled = false
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            // Optional release signing — see gradle.properties. Without a
            // configured keystore the debug APK is the private artifact.
            val ksFile = project.findProperty("RYVEN_KEYSTORE_FILE") as String?
            if (ksFile != null && file(ksFile).exists()) {
                signingConfigs {
                    create("release") {
                        storeFile = file(ksFile)
                        storePassword = project.findProperty("RYVEN_KEYSTORE_PASSWORD") as String?
                        keyAlias = project.findProperty("RYVEN_KEY_ALIAS") as String?
                        keyPassword = project.findProperty("RYVEN_KEY_PASSWORD") as String?
                    }
                }
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.recyclerview:recyclerview:1.3.2")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // Push notifications (Firebase Cloud Messaging). Initialized manually
    // from string resources — no google-services.json and no Google plugin
    // are required, so the project builds before Firebase is configured.
    implementation(platform("com.google.firebase:firebase-bom:33.1.2"))
    implementation("com.google.firebase:firebase-messaging")
}
