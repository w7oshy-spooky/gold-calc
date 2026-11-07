const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const androidDir = path.join(rootDir, 'android');

const localJdk = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'jdk-21');
const studioJbr = 'C:\\Program Files\\Android\\Android Studio\\jbr';

const envJdk = process.env.JAVA_HOME;
const msJdk = 'C:\\Program Files\\Microsoft\\jdk-21.0.13.21-hotspot';
const javaHome = (envJdk && fs.existsSync(envJdk)) ? envJdk : (fs.existsSync(localJdk) ? localJdk : (fs.existsSync(msJdk) ? msJdk : studioJbr));

console.log('1/3 🔄 Syncing web assets into Android...');
execSync('npm run cap:sync', { stdio: 'inherit', cwd: rootDir });

console.log(`2/3 🔨 Building Android APK with Gradle (using ${javaHome})...`);
const gradlewCmd = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew';
execSync(`${gradlewCmd} assembleDebug`, {
  stdio: 'inherit',
  cwd: androidDir,
  env: { ...process.env, JAVA_HOME: javaHome },
});

const generatedApk = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const targetApk = path.join(rootDir, 'gold-calc-app.apk');

if (fs.existsSync(generatedApk)) {
  fs.copyFileSync(generatedApk, targetApk);
  console.log(`3/3 ✅ Success! Updated APK generated at: ${targetApk}`);
} else {
  console.error('❌ Could not find generated APK at: ' + generatedApk);
  process.exit(1);
}
