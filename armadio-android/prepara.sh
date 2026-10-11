#!/usr/bin/env bash
# Prepara il progetto Android: copia l'app web (../armadio) dentro Capacitor,
# mette icone, permessi e numero di versione. Poi si compila con gradle.
set -euo pipefail
cd "$(dirname "$0")"

rm -rf www && mkdir www
cp -r ../armadio/. www/
rm -f www/sw.js            # nell'APK i file sono già tutti dentro: il service worker non serve

[ -d android ] || npx cap add android
npx cap sync android

# icone e schermata di avvio
cp -r res/. android/app/src/main/res/

# posizione (per "Usa la mia posizione"). La fotocamera NON va dichiarata:
# senza il permesso CAMERA Capacitor apre l'app Fotocamera di sistema, che non ne ha bisogno.
manifest=android/app/src/main/AndroidManifest.xml
if ! grep -q ACCESS_COARSE_LOCATION "$manifest"; then
  sed -i 's#<uses-permission android:name="android.permission.INTERNET" />#&\n    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />\n    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />#' "$manifest"
fi

# numero di versione: deve crescere a ogni APK perché Android accetti l'aggiornamento
versione="${VERSIONE:-1}"
sed -i -E "s/versionCode [0-9]+/versionCode $versione/; s/versionName \"[^\"]*\"/versionName \"1.$versione\"/" android/app/build.gradle

echo "Pronto: versione 1.$versione"
