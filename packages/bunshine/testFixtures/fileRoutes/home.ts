export default function setupHome(app) {
  app.get('/home', c => c.text('Home'));
}
