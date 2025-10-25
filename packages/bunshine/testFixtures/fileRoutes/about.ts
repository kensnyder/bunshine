export default function setupAbout(app) {
  app.get('/about', c => c.text('About'));
}
