const vscode = require("vscode");
const extensionModule = import("./extension.mjs");

async function activate(context) {
  const mod = await extensionModule;
  return mod.activate(context, vscode);
}

async function deactivate() {
  const mod = await extensionModule;
  return mod.deactivate?.();
}

module.exports = {
  activate,
  deactivate,
};
