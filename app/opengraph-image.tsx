import { renderBrandOg } from '@/components/seo/OgCard';

export const dynamic = 'force-static';
export const alt = 'Print Optimizer — Every PDF, Print-Perfect';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return renderBrandOg();
}
