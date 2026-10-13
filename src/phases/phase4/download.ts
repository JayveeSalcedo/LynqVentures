/** Legacy Launch `download(value, name)`: JSON files as application/json, everything else as plain text. */
export function download(value: string, name: string) {
  const blob = new Blob([value], { type: name.endsWith('.json') ? 'application/json' : 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
