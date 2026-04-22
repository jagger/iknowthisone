import QRCode from 'qrcode'

export async function generateQR(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    margin: 1,
    width: 200,
    color: { dark: '#141414', light: '#F4EFE6' },
  })
}
