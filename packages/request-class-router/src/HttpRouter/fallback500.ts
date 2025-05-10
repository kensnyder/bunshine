import type Context from '../Context/Context';

export const fallback500 = (context: Context) => {
  const error = context.error;
  console.log('\n-----\nfallback500\n', error);
  const headers = new Headers();
  let body: string;
  if (process.env.NODE_ENV === 'development') {
    const message = error ? error.message || String(error) : 'Unknown Error';
    const stack = error?.stack || 'N/A';
    headers.append('Reason', 'Error was not handled');
    headers.append('Error-Text', JSON.stringify(message));
    headers.append('Error-Stack', JSON.stringify(stack));
    headers.append('Content-Type', 'text/html');
    body = getErrorHtml(message, stack);
  } else {
    headers.append('Content-Type', 'text/plain');
    body = '500 Server Error';
  }
  return new Response(body, {
    headers,
    status: 500,
  });
};

function getErrorHtml(message: string, stack: string) {
  return `<h1>500 Server Error</h1>
          <h2>${message}</h2>
          <p>Stack trace:</p>
          <pre>${stack}</pre>`;
}
