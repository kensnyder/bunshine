export default function redirect(url: string, status = 302) {
  return new Response('', {
    status,
    headers: {
      Location: url,
    },
  });
}
