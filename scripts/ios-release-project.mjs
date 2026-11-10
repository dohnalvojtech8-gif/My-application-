import fs from 'node:fs';
import path from 'node:path';
import xcode from 'xcode';

const metadata = JSON.parse(fs.readFileSync(path.join(process.env.RUNNER_TEMP, 'money-signing/metadata.json'), 'utf8'));
const projectPath = 'ios/App/App.xcodeproj/project.pbxproj';
const project = xcode.project(projectPath);
project.parseSync();
const settings = project.pbxXCBuildConfigurationSection();
let changed = 0;
for (const config of Object.values(settings)) {
  if (!config || typeof config !== 'object' || config.name !== 'Release') continue;
  const s = config.buildSettings;
  const bundle = String(s.PRODUCT_BUNDLE_IDENTIFIER || '').replaceAll('"', '');
  if (!metadata.profiles[bundle]) continue;
  s.CODE_SIGN_STYLE = 'Manual';
  s.CODE_SIGN_IDENTITY = '"Apple Distribution"';
  s.DEVELOPMENT_TEAM = metadata.team;
  s.PROVISIONING_PROFILE_SPECIFIER = `"${metadata.profiles[bundle]}"`;
  changed++;
}
if (changed !== 2) throw new Error('Expected separate Release configurations for app and widget');
fs.writeFileSync(projectPath, project.writeSync());
console.log('Release signing configured for app and widget.');
