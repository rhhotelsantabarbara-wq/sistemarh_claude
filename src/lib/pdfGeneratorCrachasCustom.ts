import jsPDF from "jspdf";
import { saveAndBackup } from "./pdfBackupHelper";
import { todayISO } from "@/lib/date";

interface EmployeeForBadge {
  id: string;
  nome_completo: string;
  cargo: string;
  setor: string | null;
  foto_url: string | null;
  cpf: string | null;
  empresa?: {
    nome: string;
    logo_url: string | null;
  } | null;
}

interface BadgeElement {
  id: string;
  type: 'text' | 'image' | 'placeholder' | 'shape' | 'customImage';
  placeholder?: string;
  imageUrl?: string;
  shapeType?: 'rect' | 'circle' | 'line';
  left: number;
  top: number;
  width?: number;
  height?: number;
  radius?: number;
  rx?: number;
  x2?: number;
  y2?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  textAlign?: string;
}

interface BadgeTemplateConfig {
  elements: BadgeElement[];
  backgroundColor?: string;
}

interface CustomTemplate {
  id: string;
  nome: string;
  background_url: string | null;
  configuracao_json: BadgeTemplateConfig;
  orientacao: 'horizontal' | 'vertical';
  largura: number;
  altura: number;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

// Load image as base64 AND pre-decoded HTMLImageElement (so we know natural dimensions)
async function loadImage(url: string): Promise<{ base64: string; img: HTMLImageElement } | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new window.Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = base64;
    });
    return { base64, img };
  } catch {
    return null;
  }
}

function replacePlaceholder(placeholder: string, employee: EmployeeForBadge): string {
  const firstName = employee.nome_completo.split(' ')[0];
  switch (placeholder) {
    case '{{NOME}}': return firstName;
    case '{{CARGO}}': return employee.cargo || '';
    case '{{SETOR}}': return employee.setor || '';
    case '{{CPF}}':
      return employee.cpf ? employee.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '';
    case '{{EMPRESA}}': return employee.empresa?.nome || '';
    default: return placeholder;
  }
}

function mapFontFamily(fontFamily: string): string {
  const fontMap: Record<string, string> = {
    'Arial': 'helvetica',
    'Helvetica': 'helvetica',
    'Times New Roman': 'times',
    'Georgia': 'times',
    'Courier New': 'courier',
    'Verdana': 'helvetica',
    'Impact': 'helvetica',
  };
  return fontMap[fontFamily] || 'helvetica';
}

// Render an image into an offscreen canvas using "cover" fit (crops excess, no distortion).
// Optionally clips into a circle. Returns a PNG data URL ready for jsPDF.addImage.
function renderImageCover(img: HTMLImageElement, widthMm: number, heightMm: number, circular: boolean): string {
  // Render at ~300 DPI equivalent for crisp print
  const pxPerMm = 300 / 25.4;
  const w = Math.max(1, Math.round(widthMm * pxPerMm));
  const h = Math.max(1, Math.round(heightMm * pxPerMm));
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const ctx = off.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (circular) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
  }

  const ir = img.naturalWidth / img.naturalHeight;
  const br = w / h;
  let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
  if (ir > br) {
    sw = img.naturalHeight * br;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / br;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  if (circular) ctx.restore();
  return off.toDataURL('image/png');
}

export async function generateCustomBadgesPDF(
  employees: EmployeeForBadge[],
  template: CustomTemplate
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const badgeWidth = template.largura;
  const badgeHeight = template.altura;

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 10;

  const availableWidth = pageWidth - 2 * margin;
  const availableHeight = pageHeight - 2 * margin;

  const cols = Math.max(1, Math.floor(availableWidth / badgeWidth));
  const rows = Math.max(1, Math.floor(availableHeight / badgeHeight));
  const badgesPerPage = cols * rows;

  const totalWidth = cols * badgeWidth;
  const totalHeight = rows * badgeHeight;
  const startX = margin + (availableWidth - totalWidth) / 2;
  const startY = margin + (availableHeight - totalHeight) / 2;

  const canvasWidth = template.orientacao === 'horizontal' ? 400 : 250;
  const canvasHeight = template.orientacao === 'horizontal' ? 250 : 400;
  const scaleX = badgeWidth / canvasWidth;
  const scaleY = badgeHeight / canvasHeight;

  // Preload all images
  const background = template.background_url ? await loadImage(template.background_url) : null;

  const employeeImages = new Map<string, { base64: string; img: HTMLImageElement } | null>();
  const companyLogos = new Map<string, { base64: string; img: HTMLImageElement } | null>();

  await Promise.all(employees.map(async (emp) => {
    if (emp.foto_url) employeeImages.set(emp.id, await loadImage(emp.foto_url));
    if (emp.empresa?.logo_url && !companyLogos.has(emp.empresa.logo_url)) {
      companyLogos.set(emp.empresa.logo_url, await loadImage(emp.empresa.logo_url));
    }
  }));

  const config = template.configuracao_json;

  // Preload custom images referenced in the template
  const customImages = new Map<string, { base64: string; img: HTMLImageElement } | null>();
  for (const el of config.elements || []) {
    if (el.type === 'customImage' && el.imageUrl && !customImages.has(el.imageUrl)) {
      customImages.set(el.imageUrl, await loadImage(el.imageUrl));
    }
  }

  for (let i = 0; i < employees.length; i++) {
    const employee = employees[i];
    const positionOnPage = i % badgesPerPage;
    const col = positionOnPage % cols;
    const row = Math.floor(positionOnPage / cols);

    if (i > 0 && positionOnPage === 0) doc.addPage();

    const x = startX + col * badgeWidth;
    const y = startY + row * badgeHeight;

    // Background fill
    if (config.backgroundColor) {
      const bg = hexToRgb(config.backgroundColor);
      doc.setFillColor(bg.r, bg.g, bg.b);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    doc.rect(x, y, badgeWidth, badgeHeight, 'F');

    // Background image (cover-fit so it doesn't distort)
    if (background) {
      try {
        const bgData = renderImageCover(background.img, badgeWidth, badgeHeight, false);
        doc.addImage(bgData, 'PNG', x, y, badgeWidth, badgeHeight);
      } catch (e) {
        console.error('Error adding background image:', e);
      }
    }

    // Border last so it stays crisp
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.25);
    doc.rect(x, y, badgeWidth, badgeHeight, 'S');

    for (const element of config.elements || []) {
      const elemX = x + element.left * scaleX;
      const elemY = y + element.top * scaleY;

      if (element.type === 'shape') {
        const sw = (element.strokeWidth || 0) * scaleX;
        const hasFill = !!element.fill && element.fill !== 'transparent' && element.fill !== '';
        const hasStroke = !!element.stroke && element.stroke !== '' && sw > 0;
        if (hasFill) {
          const c = hexToRgb(element.fill!);
          doc.setFillColor(c.r, c.g, c.b);
        }
        if (hasStroke) {
          const c = hexToRgb(element.stroke!);
          doc.setDrawColor(c.r, c.g, c.b);
          doc.setLineWidth(sw);
        }
        const style = hasFill && hasStroke ? 'FD' : hasFill ? 'F' : hasStroke ? 'S' : null;

        if (element.shapeType === 'circle') {
          const r = (element.radius || 30) * scaleX;
          if (style) doc.circle(elemX + r, elemY + r, r, style);
        } else if (element.shapeType === 'line') {
          if (hasStroke) {
            const x2 = x + (element.x2 ?? element.left) * scaleX;
            const y2 = y + (element.y2 ?? element.top) * scaleY;
            doc.line(elemX, elemY, x2, y2);
          }
        } else {
          const w = (element.width || 80) * scaleX;
          const h = (element.height || 50) * scaleY;
          const rx = (element.rx || 0) * scaleX;
          if (style) {
            if (rx > 0 && (doc as any).roundedRect) {
              (doc as any).roundedRect(elemX, elemY, w, h, rx, rx, style);
            } else {
              doc.rect(elemX, elemY, w, h, style);
            }
          }
        }
        continue;
      }


      if (element.type === 'text' || element.type === 'placeholder') {
        const text = element.placeholder ? replacePlaceholder(element.placeholder, employee) : '';
        if (!text) continue;

        // Convert canvas px to PDF pt: px * (mm/px) * (pt/mm) where 1mm = 2.8346pt
        let fontPt = (element.fontSize || 16) * scaleX * 2.8346;
        const fontFamily = mapFontFamily(element.fontFamily || 'Arial');
        const fontStyle = element.fontWeight === 'bold' ? 'bold' : 'normal';

        doc.setFont(fontFamily, fontStyle);
        doc.setFontSize(fontPt);

        if (element.fill) {
          const c = hexToRgb(element.fill);
          doc.setTextColor(c.r, c.g, c.b);
        } else {
          doc.setTextColor(0, 0, 0);
        }

        const elemWidth = (element.width || 150) * scaleX;

        // Auto-shrink if overflows
        if (elemWidth > 0) {
          const w = doc.getTextWidth(text);
          if (w > elemWidth) {
            fontPt = Math.max(4, fontPt * (elemWidth / w));
            doc.setFontSize(fontPt);
          }
        }

        let textX = elemX;
        let align: 'left' | 'center' | 'right' = 'left';
        if (element.textAlign === 'center') {
          align = 'center';
          textX = elemX + elemWidth / 2;
        } else if (element.textAlign === 'right') {
          align = 'right';
          textX = elemX + elemWidth;
        }

        // jsPDF text Y is the baseline. Position baseline ~75% down the cap box.
        // 1pt = 0.3528mm
        const baselineOffsetMm = fontPt * 0.3528 * 0.78;
        doc.text(text, textX, elemY + baselineOffsetMm, { align, baseline: 'alphabetic' });
      } else if (element.type === 'image') {
        const elemWidth = (element.width || 80) * scaleX;
        const elemHeight = (element.height || 80) * scaleY;
        const sw = (element.strokeWidth || 0) * scaleX;
        const hasStroke = !!element.stroke && element.stroke !== '' && sw > 0;

        if (element.placeholder === 'foto') {
          const photo = employeeImages.get(employee.id);
          const cx = elemX + elemWidth / 2;
          const cy = elemY + elemHeight / 2;
          const r = Math.min(elemWidth, elemHeight) / 2;
          if (photo) {
            try {
              const data = renderImageCover(photo.img, elemWidth, elemHeight, true);
              doc.addImage(data, 'PNG', elemX, elemY, elemWidth, elemHeight);
            } catch {
              doc.setFillColor(229, 231, 235);
              doc.circle(cx, cy, r, 'F');
            }
          } else {
            doc.setFillColor(229, 231, 235);
            doc.circle(cx, cy, r, 'F');
          }
          if (hasStroke) {
            const c = hexToRgb(element.stroke!);
            doc.setDrawColor(c.r, c.g, c.b);
            doc.setLineWidth(sw);
            doc.circle(cx, cy, r, 'S');
          }
        } else if (element.placeholder === 'logo') {
          const logoUrl = employee.empresa?.logo_url;
          const logo = logoUrl ? companyLogos.get(logoUrl) : null;
          if (logo) {
            const ir = logo.img.naturalWidth / logo.img.naturalHeight;
            const br = elemWidth / elemHeight;
            let dw = elemWidth, dh = elemHeight, dx = elemX, dy = elemY;
            if (ir > br) {
              dh = elemWidth / ir;
              dy = elemY + (elemHeight - dh) / 2;
            } else {
              dw = elemHeight * ir;
              dx = elemX + (elemWidth - dw) / 2;
            }
            try {
              doc.addImage(logo.base64, 'PNG', dx, dy, dw, dh);
            } catch {
              try { doc.addImage(logo.base64, 'JPEG', dx, dy, dw, dh); } catch {}
            }
          } else {
            doc.setFillColor(229, 231, 235);
            doc.rect(elemX, elemY, elemWidth, elemHeight, 'F');
          }
          if (hasStroke) {
            const c = hexToRgb(element.stroke!);
            doc.setDrawColor(c.r, c.g, c.b);
            doc.setLineWidth(sw);
            doc.rect(elemX, elemY, elemWidth, elemHeight, 'S');
          }
        }
      } else if (element.type === 'customImage' && element.imageUrl) {
        const elemWidth = (element.width || 80) * scaleX;
        const elemHeight = (element.height || 80) * scaleY;
        const data = customImages.get(element.imageUrl);
        if (data) {
          try {
            doc.addImage(data.base64, 'PNG', elemX, elemY, elemWidth, elemHeight);
          } catch {
            try { doc.addImage(data.base64, 'JPEG', elemX, elemY, elemWidth, elemHeight); } catch {}
          }
        }
        const sw = (element.strokeWidth || 0) * scaleX;
        if (element.stroke && element.stroke !== '' && sw > 0) {
          const c = hexToRgb(element.stroke);
          doc.setDrawColor(c.r, c.g, c.b);
          doc.setLineWidth(sw);
          doc.rect(elemX, elemY, elemWidth, elemHeight, 'S');
        }
      }
    }
  }

  const timestamp = todayISO();
  const fileName = `crachas_personalizado_${timestamp}.pdf`;
  saveAndBackup(doc, fileName, "Crachas");
}
