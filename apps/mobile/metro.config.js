const fs = require('fs');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const projectMods = path.resolve(projectRoot, 'node_modules');
const rootMods = path.resolve(workspaceRoot, 'node_modules');
const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [projectMods, rootMods];
config.resolver.disableHierarchicalLookup = true;
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;

/** pnpm keeps some Expo deps (e.g. whatwg-fetch) only at the workspace root. */
config.resolver.extraNodeModules = new Proxy(
  {},
  {
    get(_target, name) {
      if (typeof name !== 'string' || name.startsWith('__')) return undefined;
      const local = path.join(projectMods, name);
      if (fs.existsSync(local)) return local;
      const hoisted = path.join(rootMods, name);
      if (fs.existsSync(hoisted)) return hoisted;
      return local;
    },
  },
);

module.exports = config;
