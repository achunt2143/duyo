import { createDuyoConfig } from '@duyo/vite-plugin/create-config';

export default createDuyoConfig({
  appKind: '{{PROJECT_NAME_PASCAL}}.Application',
  renderTarget: 'root'
});
