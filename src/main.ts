import themes from 'devextreme/ui/themes';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { licenseKey } from './devextreme-license';
import { AppModule } from './app/app.module';
import config from 'devextreme/core/config';

config({licenseKey});

themes.initialized(() => {
  platformBrowserDynamic().bootstrapModule(AppModule)
    .catch(err => console.error(err));
});
