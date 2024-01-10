import { dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import logger, { MainLogger } from 'electron-log';

/* Enable logging */
autoUpdater.logger = logger;
if (isMainLogger(autoUpdater.logger)) {
  autoUpdater.logger.transports.file.level = 'info';
}

autoUpdater.autoDownload = false;

export default function () {
  autoUpdater.checkForUpdates();

  /* Ask for update */
  autoUpdater.on('update-available', async () => {
    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Update available',
      message: 'A new version is available',
      buttons: ['Update', 'No'],
    });

    if (result.response === 0) {
      autoUpdater.downloadUpdate();
    }
  });

  /* Ask for install */
  autoUpdater.on('update-downloaded', async () => {
    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Update ready',
      message: 'Install and restart?',
      buttons: ['Yes', 'Later'],
    });

    if (result.response === 0) {
      autoUpdater.quitAndInstall(false, true);
    }
  });

  autoUpdater.on('update-not-available', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update not available',
      message: 'Application is up to date',
      buttons: ['Ok'],
    });
  });
}

function isMainLogger(logger: any): logger is MainLogger {
  return typeof logger.initialize === 'function';
}
