export default function isModifiedSince(
  request: Request,
  lastModified: Date
): boolean {
  const ifModifiedSince = request.headers.get('If-Modified-Since');
  if (!ifModifiedSince) {
    return true;
  }
  // Parse the If-Modified-Since header into a Date object
  const imsDate = new Date(ifModifiedSince);

  // Check if the parsed date is valid
  if (isNaN(imsDate.getTime())) {
    // If the date is invalid, assume the resource has been modified
    return true;
  }

  // Compare the parsed date with the resource's last modified date
  return lastModified > imsDate;
}
