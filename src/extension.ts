import * as vscode from 'vscode';
import { VicCustomProvider } from './vicProvider';

export function activate(context: vscode.ExtensionContext): void {
  const extensionRoot = vscode.Uri.file(context.extensionPath);
  // Register our custom editor provider
  const provider = new VicCustomProvider(extensionRoot);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      VicCustomProvider.viewType,
      provider,
      {
        webviewOptions: {
          enableFindWidget: false, // default
          retainContextWhenHidden: true,
        },
      }
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('vicPreview.zoomIn', () => {
      provider.activePreview?.zoomIn();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vicPreview.zoomOut', () => {
      provider.activePreview?.zoomOut();
    })
  );
}

export function deactivate(): void {}
