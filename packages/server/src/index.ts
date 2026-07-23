import { loadConfig } from './config';
import { createApp } from './app';

const config = loadConfig();
const app = createApp(config);

app.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
});
