export async function copyText(text: string): Promise<void> {
  if (!navigator.clipboard) throw new Error('Bu tarayıcıda pano kullanılamıyor.');
  await navigator.clipboard.writeText(text);
}

export function downloadText(name: string, text: string, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
