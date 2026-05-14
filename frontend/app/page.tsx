import { routing } from '@/i18n/routing';

export default function RootPage() {
  return null;
}

export async function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

