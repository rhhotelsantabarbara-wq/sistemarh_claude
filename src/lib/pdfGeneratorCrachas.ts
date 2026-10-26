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

export interface BadgeTemplate {
  id: string;
  name: string;
  headerColor: string;
  textColor: string;
  accentColor: string;
  style: "modern" | "classic" | "minimal" | "corporate";
}

export const BADGE_TEMPLATES: BadgeTemplate[] = [
  {
    id: "modern-blue",
    name: "Moderno Azul",
    headerColor: "#3B82F6",
    textColor: "#1E3A8A",
    accentColor: "#60A5FA",
    style: "modern",
  },
  {
    id: "corporate-dark",
    name: "Corporativo Escuro",
    headerColor: "#1F2937",
    textColor: "#111827",
    accentColor: "#4B5563",
    style: "corporate",
  },
  {
    id: "classic-green",
    name: "Clássico Verde",
    headerColor: "#059669",
    textColor: "#065F46",
    accentColor: "#34D399",
    style: "classic",
  },
  {
    id: "minimal-gray",
    name: "Minimalista",
    headerColor: "#6B7280",
    textColor: "#374151",
    accentColor: "#9CA3AF",
    style: "minimal",
  },
  {
    id: "vibrant-purple",
    name: "Vibrante Roxo",
    headerColor: "#7C3AED",
    textColor: "#5B21B6",
    accentColor: "#A78BFA",
    style: "modern",
  },
  {
    id: "elegant-red",
    name: "Elegante Vermelho",
    headerColor: "#DC2626",
    textColor: "#991B1B",
    accentColor: "#F87171",
    style: "corporate",
  },
];

interface BadgeOptions {
  showCpf: boolean;
  showSector: boolean;
  showCompanyLogo: boolean;
  showPhoto: boolean;
  showCargo: boolean;
  orientation: "horizontal" | "vertical";
  template: BadgeTemplate;
  customHeaderColor?: string;
}

// Horizontal dimensions
const H_BADGE_WIDTH = 85;
const H_BADGE_HEIGHT = 54;
const H_BADGES_PER_ROW = 2;
const H_BADGES_PER_COLUMN = 4;

// Vertical dimensions
const V_BADGE_WIDTH = 54;
const V_BADGE_HEIGHT = 85;
const V_BADGES_PER_ROW = 3;
const V_BADGES_PER_COLUMN = 3;

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 59, g: 130, b: 246 };
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function drawPlaceholderIcon(doc: jsPDF, x: number, y: number, size: number) {
  doc.setFillColor(220, 220, 225);
  doc.setDrawColor(200, 200, 205);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, size, size, 2, 2, "FD");
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(size * 0.5);
  doc.text("?", x + size / 2, y + size * 0.65, { align: "center" });
}

function drawCutMarks(doc: jsPDF, x: number, y: number, width: number, height: number) {
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.1);
  const markLen = 3;

  // Corners
  doc.line(x - markLen, y, x - 1, y);
  doc.line(x, y - markLen, x, y - 1);
  doc.line(x + width + 1, y, x + width + markLen, y);
  doc.line(x + width, y - markLen, x + width, y - 1);
  doc.line(x - markLen, y + height, x - 1, y + height);
  doc.line(x, y + height + 1, x, y + height + markLen);
  doc.line(x + width + 1, y + height, x + width + markLen, y + height);
  doc.line(x + width, y + height + 1, x + width, y + height + markLen);
}

// ========== HORIZONTAL BADGES ==========

function drawHorizontalModern(
  doc: jsPDF,
  employee: EmployeeForBadge,
  x: number,
  y: number,
  options: BadgeOptions,
  employeePhoto: string | null,
  companyLogo: string | null
) {
  const headerColor = hexToRgb(options.customHeaderColor || options.template.headerColor);
  const accentColor = hexToRgb(options.template.accentColor);

  // Shadow effect
  doc.setFillColor(220, 220, 225);
  doc.roundedRect(x + 0.5, y + 0.5, H_BADGE_WIDTH, H_BADGE_HEIGHT, 3, 3, "F");

  // Main background with gradient effect
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, H_BADGE_WIDTH, H_BADGE_HEIGHT, 3, 3, "F");

  // Header with extended height
  doc.setFillColor(headerColor.r, headerColor.g, headerColor.b);
  doc.roundedRect(x, y, H_BADGE_WIDTH, 16, 3, 3, "F");
  doc.rect(x, y + 10, H_BADGE_WIDTH, 6, "F");

  // Decorative accent stripe
  doc.setFillColor(accentColor.r, accentColor.g, accentColor.b);
  doc.rect(x, y + 16, H_BADGE_WIDTH, 2.5, "F");

  // Bottom decorative line
  doc.setFillColor(headerColor.r, headerColor.g, headerColor.b);
  doc.rect(x, y + H_BADGE_HEIGHT - 3, H_BADGE_WIDTH, 3, "F");
  doc.roundedRect(x, y + H_BADGE_HEIGHT - 3, H_BADGE_WIDTH, 3, 0, 0, "F");
  doc.roundedRect(x, y, H_BADGE_WIDTH, H_BADGE_HEIGHT, 3, 3, "S");

  // Company logo and name - logo above name, centered
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");

  if (options.showCompanyLogo && companyLogo) {
    try {
      // Logo centered at top
      doc.addImage(companyLogo, "PNG", x + (H_BADGE_WIDTH - 20) / 2, y + 2, 20, 8);
      // Company name below logo - full name with dynamic font
      if (employee.empresa?.nome) {
        const companyName = employee.empresa.nome.toUpperCase();
        doc.setFontSize(companyName.length > 30 ? 5 : companyName.length > 20 ? 6 : 7);
        doc.text(companyName, x + H_BADGE_WIDTH / 2, y + 13, { align: "center" });
      }
    } catch {
      doc.setFontSize(9);
      doc.text(employee.empresa?.nome?.toUpperCase() || "IDENTIFICAÇÃO", x + H_BADGE_WIDTH / 2, y + 10, { align: "center" });
    }
  } else {
    const companyName = employee.empresa?.nome?.toUpperCase() || "IDENTIFICAÇÃO";
    doc.setFontSize(companyName.length > 30 ? 6 : companyName.length > 20 ? 7 : 9);
    doc.text(companyName, x + H_BADGE_WIDTH / 2, y + 10, { align: "center" });
  }

  // Content area - with proper top margin
  let contentX = x + 5;
  const contentY = y + 22; // Increased top margin

  // Photo with border effect
  if (options.showPhoto) {
    const photoSize = 24;
    if (employeePhoto) {
      try {
        // Photo shadow
        doc.setFillColor(200, 200, 205);
        doc.roundedRect(contentX + 0.5, contentY + 0.5, photoSize, photoSize, 2, 2, "F");
        // Photo border
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(contentX, contentY, photoSize, photoSize, 2, 2, "F");
        doc.setDrawColor(headerColor.r, headerColor.g, headerColor.b);
        doc.setLineWidth(0.8);
        doc.roundedRect(contentX, contentY, photoSize, photoSize, 2, 2, "D");
        doc.addImage(employeePhoto, "JPEG", contentX + 1, contentY + 1, photoSize - 2, photoSize - 2);
      } catch {
        drawPlaceholderIcon(doc, contentX, contentY, photoSize);
      }
    } else {
      drawPlaceholderIcon(doc, contentX, contentY, photoSize);
    }
    contentX += photoSize + 5;
  }

  // Info area - centered with proper padding
  const infoAreaCenterX = options.showPhoto ? contentX + (H_BADGE_WIDTH - contentX + x - 5) / 2 : x + H_BADGE_WIDTH / 2;
  let infoY = contentY + 4; // Top margin for text

  // Name - only first name
  doc.setTextColor(25, 25, 35);
  doc.setFont("helvetica", "bold");
  const firstName = employee.nome_completo.split(" ")[0].toUpperCase();
  doc.setFontSize(16);
  doc.text(firstName, infoAreaCenterX, infoY, { align: "center" });
  infoY += 7;

  if (options.showCargo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(90, 90, 100);
    const maxCargoLen = options.showPhoto ? 18 : 32;
    const cargo = employee.cargo.length > maxCargoLen ? employee.cargo.substring(0, maxCargoLen) + "..." : employee.cargo;
    doc.text(cargo, infoAreaCenterX, infoY, { align: "center" });
    infoY += 5;
  }

  if (options.showSector && employee.setor) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(headerColor.r, headerColor.g, headerColor.b);
    const maxSetorLen = options.showPhoto ? 14 : 26;
    const setor = employee.setor.length > maxSetorLen ? employee.setor.substring(0, maxSetorLen) + "..." : employee.setor;
    doc.text(setor.toUpperCase(), infoAreaCenterX, infoY, { align: "center" });
  }

  // CPF in bottom bar
  if (options.showCpf && employee.cpf) {
    doc.setFontSize(6);
    doc.setTextColor(255, 255, 255);
    doc.text(`CPF: ${employee.cpf}`, x + H_BADGE_WIDTH / 2, y + H_BADGE_HEIGHT - 0.5, { align: "center" });
  }

  drawCutMarks(doc, x, y, H_BADGE_WIDTH, H_BADGE_HEIGHT);
}

function drawHorizontalClassic(
  doc: jsPDF,
  employee: EmployeeForBadge,
  x: number,
  y: number,
  options: BadgeOptions,
  employeePhoto: string | null,
  companyLogo: string | null
) {
  const headerColor = hexToRgb(options.customHeaderColor || options.template.headerColor);

  // Elegant border with double line effect
  doc.setFillColor(252, 252, 255);
  doc.setDrawColor(headerColor.r, headerColor.g, headerColor.b);
  doc.setLineWidth(1.2);
  doc.roundedRect(x, y, H_BADGE_WIDTH, H_BADGE_HEIGHT, 2, 2, "FD");
  
  // Inner border
  doc.setLineWidth(0.3);
  doc.roundedRect(x + 2, y + 2, H_BADGE_WIDTH - 4, H_BADGE_HEIGHT - 4, 1.5, 1.5, "D");

  // Header with elegant design
  doc.setFillColor(headerColor.r, headerColor.g, headerColor.b);
  doc.roundedRect(x + 3, y + 3, H_BADGE_WIDTH - 6, 13, 1.5, 1.5, "F");

  // Gold-style accent line
  const lighterColor = {
    r: Math.min(255, headerColor.r + 60),
    g: Math.min(255, headerColor.g + 60),
    b: Math.min(255, headerColor.b + 60)
  };
  doc.setFillColor(lighterColor.r, lighterColor.g, lighterColor.b);
  doc.rect(x + 3, y + 14, H_BADGE_WIDTH - 6, 1.5, "F");

  // Company logo and name - logo above name, centered
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");

  if (options.showCompanyLogo && companyLogo) {
    try {
      // Logo centered at top
      doc.addImage(companyLogo, "PNG", x + (H_BADGE_WIDTH - 18) / 2, y + 4, 18, 7);
      // Company name below logo - full name
      if (employee.empresa?.nome) {
        const companyName = employee.empresa.nome.toUpperCase();
        doc.setFontSize(companyName.length > 30 ? 4 : companyName.length > 20 ? 5 : 6);
        doc.text(companyName, x + H_BADGE_WIDTH / 2, y + 14, { align: "center" });
      }
    } catch {
      const companyName = employee.empresa?.nome?.toUpperCase() || "CRACHÁ";
      doc.setFontSize(companyName.length > 20 ? 6 : 8);
      doc.text(companyName, x + H_BADGE_WIDTH / 2, y + 11, { align: "center" });
    }
  } else {
    const companyName = employee.empresa?.nome?.toUpperCase() || "CRACHÁ";
    doc.setFontSize(companyName.length > 20 ? 6 : 8);
    doc.text(companyName, x + H_BADGE_WIDTH / 2, y + 11, { align: "center" });
  }

  // Content with proper top margin
  let contentX = x + 6;
  const contentY = y + 20; // Increased top margin

  if (options.showPhoto) {
    const photoSize = 22;
    if (employeePhoto) {
      try {
        doc.setDrawColor(headerColor.r, headerColor.g, headerColor.b);
        doc.setLineWidth(0.5);
        doc.rect(contentX, contentY, photoSize, photoSize, "D");
        doc.addImage(employeePhoto, "JPEG", contentX + 0.5, contentY + 0.5, photoSize - 1, photoSize - 1);
      } catch {
        drawPlaceholderIcon(doc, contentX, contentY, photoSize);
      }
    } else {
      drawPlaceholderIcon(doc, contentX, contentY, photoSize);
    }
    contentX += photoSize + 5;
  }

  // Info area - centered with proper padding
  const infoAreaCenterX = options.showPhoto ? contentX + (H_BADGE_WIDTH - contentX + x - 6) / 2 : x + H_BADGE_WIDTH / 2;
  let infoY = contentY + 4;

  // Name - only first name
  doc.setTextColor(headerColor.r, headerColor.g, headerColor.b);
  doc.setFont("helvetica", "bold");
  const firstName = employee.nome_completo.split(" ")[0].toUpperCase();
  doc.setFontSize(16);
  doc.text(firstName, infoAreaCenterX, infoY, { align: "center" });
  infoY += 7;

  if (options.showCargo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(70, 70, 75);
    doc.text(employee.cargo.substring(0, options.showPhoto ? 18 : 32), infoAreaCenterX, infoY, { align: "center" });
    infoY += 5;
  }

  if (options.showSector && employee.setor) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(headerColor.r, headerColor.g, headerColor.b);
    doc.text(employee.setor.substring(0, options.showPhoto ? 14 : 28).toUpperCase(), infoAreaCenterX, infoY, { align: "center" });
  }

  if (options.showCpf && employee.cpf) {
    doc.setFontSize(6);
    doc.setTextColor(120, 120, 125);
    doc.text(`CPF: ${employee.cpf}`, x + H_BADGE_WIDTH / 2, y + H_BADGE_HEIGHT - 4, { align: "center" });
  }

  drawCutMarks(doc, x, y, H_BADGE_WIDTH, H_BADGE_HEIGHT);
}

function drawHorizontalMinimal(
  doc: jsPDF,
  employee: EmployeeForBadge,
  x: number,
  y: number,
  options: BadgeOptions,
  employeePhoto: string | null,
  companyLogo: string | null
) {
  const headerColor = hexToRgb(options.customHeaderColor || options.template.headerColor);

  // Clean white background with subtle shadow
  doc.setFillColor(235, 235, 240);
  doc.roundedRect(x + 0.4, y + 0.4, H_BADGE_WIDTH, H_BADGE_HEIGHT, 4, 4, "F");
  
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, H_BADGE_WIDTH, H_BADGE_HEIGHT, 4, 4, "F");

  // Elegant top stripe with rounded corners
  doc.setFillColor(headerColor.r, headerColor.g, headerColor.b);
  doc.roundedRect(x, y, H_BADGE_WIDTH, 5, 4, 4, "F");
  doc.rect(x, y + 3, H_BADGE_WIDTH, 2, "F");

  // Company name - full name with dynamic font
  if (employee.empresa?.nome) {
    doc.setTextColor(headerColor.r, headerColor.g, headerColor.b);
    doc.setFont("helvetica", "bold");
    const companyName = employee.empresa.nome.toUpperCase();
    doc.setFontSize(companyName.length > 30 ? 5 : companyName.length > 20 ? 6 : 7);
    doc.text(companyName, x + H_BADGE_WIDTH / 2, y + 11, { align: "center" });
  }

  // Subtle divider line
  doc.setDrawColor(headerColor.r, headerColor.g, headerColor.b);
  doc.setLineWidth(0.2);
  doc.line(x + 10, y + 14, x + H_BADGE_WIDTH - 10, y + 14);

  // Content with proper top margin
  let contentX = x + 5;
  const contentY = y + 18; // Good top margin

  if (options.showPhoto) {
    const photoSize = 24;
    if (employeePhoto) {
      try {
        // Circular photo effect
        doc.setFillColor(headerColor.r, headerColor.g, headerColor.b);
        doc.circle(contentX + photoSize / 2, contentY + photoSize / 2, photoSize / 2 + 0.8, "F");
        doc.addImage(employeePhoto, "JPEG", contentX, contentY, photoSize, photoSize);
      } catch {
        doc.setFillColor(240, 240, 245);
        doc.circle(contentX + photoSize / 2, contentY + photoSize / 2, photoSize / 2, "F");
      }
    } else {
      doc.setFillColor(240, 240, 245);
      doc.circle(contentX + photoSize / 2, contentY + photoSize / 2, photoSize / 2, "F");
    }
    contentX += photoSize + 6;
  }

  // Info area - centered with padding
  const infoAreaCenterX = options.showPhoto ? contentX + (H_BADGE_WIDTH - contentX + x - 5) / 2 : x + H_BADGE_WIDTH / 2;
  let infoY = contentY + 4;

  // Name - only first name
  doc.setTextColor(35, 35, 45);
  doc.setFont("helvetica", "bold");
  const firstName = employee.nome_completo.split(" ")[0].toUpperCase();
  doc.setFontSize(16);
  doc.text(firstName, infoAreaCenterX, infoY, { align: "center" });
  infoY += 7;

  if (options.showCargo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(130, 130, 135);
    doc.text(employee.cargo.substring(0, options.showPhoto ? 18 : 32), infoAreaCenterX, infoY, { align: "center" });
    infoY += 5;
  }

  if (options.showSector && employee.setor) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(headerColor.r, headerColor.g, headerColor.b);
    doc.text(employee.setor.substring(0, options.showPhoto ? 14 : 26).toUpperCase(), infoAreaCenterX, infoY, { align: "center" });
  }

  if (options.showCpf && employee.cpf) {
    doc.setFontSize(6);
    doc.setTextColor(170, 170, 175);
    doc.text(employee.cpf, x + H_BADGE_WIDTH / 2, y + H_BADGE_HEIGHT - 3, { align: "center" });
  }

  drawCutMarks(doc, x, y, H_BADGE_WIDTH, H_BADGE_HEIGHT);
}

function drawHorizontalCorporate(
  doc: jsPDF,
  employee: EmployeeForBadge,
  x: number,
  y: number,
  options: BadgeOptions,
  employeePhoto: string | null,
  companyLogo: string | null
) {
  const headerColor = hexToRgb(options.customHeaderColor || options.template.headerColor);
  const accentColor = hexToRgb(options.template.accentColor);

  // Professional background with subtle texture
  doc.setFillColor(248, 248, 252);
  doc.roundedRect(x, y, H_BADGE_WIDTH, H_BADGE_HEIGHT, 2, 2, "F");

  // Strong left accent bar
  doc.setFillColor(headerColor.r, headerColor.g, headerColor.b);
  doc.roundedRect(x, y, 6, H_BADGE_HEIGHT, 2, 0, "F");
  doc.rect(x + 4, y, 2, H_BADGE_HEIGHT, "F");

  // Top header bar
  doc.setFillColor(headerColor.r, headerColor.g, headerColor.b);
  doc.rect(x + 6, y, H_BADGE_WIDTH - 6, 14, "F");
  
  // Accent stripe under header
  doc.setFillColor(accentColor.r, accentColor.g, accentColor.b);
  doc.rect(x + 6, y + 14, H_BADGE_WIDTH - 6, 2, "F");

  // Bottom bar
  doc.setFillColor(headerColor.r, headerColor.g, headerColor.b);
  doc.rect(x + 6, y + H_BADGE_HEIGHT - 4, H_BADGE_WIDTH - 6, 4, "F");
  doc.roundedRect(x, y, H_BADGE_WIDTH, H_BADGE_HEIGHT, 2, 2, "S");

  // Company logo and name - logo above name, centered
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");

  if (options.showCompanyLogo && companyLogo) {
    try {
      // Logo centered at top
      doc.addImage(companyLogo, "PNG", x + 6 + (H_BADGE_WIDTH - 6 - 18) / 2, y + 2, 18, 8);
      // Company name below logo - full name
      if (employee.empresa?.nome) {
        const companyName = employee.empresa.nome.toUpperCase();
        doc.setFontSize(companyName.length > 30 ? 4 : companyName.length > 20 ? 5 : 6);
        doc.text(companyName, x + (H_BADGE_WIDTH + 6) / 2, y + 12, { align: "center" });
      }
    } catch {
      const companyName = employee.empresa?.nome?.toUpperCase() || "CORPORATIVO";
      doc.setFontSize(companyName.length > 20 ? 6 : 8);
      doc.text(companyName, x + (H_BADGE_WIDTH + 6) / 2, y + 9, { align: "center" });
    }
  } else {
    const companyName = employee.empresa?.nome?.toUpperCase() || "CORPORATIVO";
    doc.setFontSize(companyName.length > 20 ? 6 : 8);
    doc.text(companyName, x + (H_BADGE_WIDTH + 6) / 2, y + 9, { align: "center" });
  }

  // Content with proper top margin
  let contentX = x + 10;
  const contentY = y + 20; // Increased top margin

  if (options.showPhoto) {
    const photoSize = 22;
    if (employeePhoto) {
      try {
        // Professional photo frame
        doc.setFillColor(accentColor.r, accentColor.g, accentColor.b);
        doc.rect(contentX - 1, contentY - 1, photoSize + 2, photoSize + 2, "F");
        doc.addImage(employeePhoto, "JPEG", contentX, contentY, photoSize, photoSize);
      } catch {
        drawPlaceholderIcon(doc, contentX, contentY, photoSize);
      }
    } else {
      drawPlaceholderIcon(doc, contentX, contentY, photoSize);
    }
    contentX += photoSize + 5;
  }

  // Info area - centered with proper padding
  const infoAreaCenterX = options.showPhoto ? contentX + (H_BADGE_WIDTH - contentX + x - 8) / 2 : x + (H_BADGE_WIDTH + 6) / 2;
  let infoY = contentY + 4;

  // Name - only first name
  doc.setTextColor(headerColor.r, headerColor.g, headerColor.b);
  doc.setFont("helvetica", "bold");
  const firstName = employee.nome_completo.split(" ")[0].toUpperCase();
  doc.setFontSize(16);
  doc.text(firstName, infoAreaCenterX, infoY, { align: "center" });
  infoY += 7;

  if (options.showCargo) {
    doc.setTextColor(85, 85, 95);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.text(employee.cargo.substring(0, options.showPhoto ? 18 : 32), infoAreaCenterX, infoY, { align: "center" });
    infoY += 5;
  }

  if (options.showSector && employee.setor) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(accentColor.r, accentColor.g, accentColor.b);
    doc.text(employee.setor.substring(0, options.showPhoto ? 14 : 24).toUpperCase(), infoAreaCenterX, infoY, { align: "center" });
  }

  // CPF in bottom bar
  if (options.showCpf && employee.cpf) {
    doc.setFontSize(6);
    doc.setTextColor(255, 255, 255);
    doc.text(`CPF: ${employee.cpf}`, x + (H_BADGE_WIDTH + 6) / 2, y + H_BADGE_HEIGHT - 1, { align: "center" });
  }

  drawCutMarks(doc, x, y, H_BADGE_WIDTH, H_BADGE_HEIGHT);
}

// ========== VERTICAL BADGES ==========

function drawVerticalModern(
  doc: jsPDF,
  employee: EmployeeForBadge,
  x: number,
  y: number,
  options: BadgeOptions,
  employeePhoto: string | null,
  companyLogo: string | null
) {
  const headerColor = hexToRgb(options.customHeaderColor || options.template.headerColor);
  const accentColor = hexToRgb(options.template.accentColor);

  // Shadow effect
  doc.setFillColor(220, 220, 225);
  doc.roundedRect(x + 0.4, y + 0.4, V_BADGE_WIDTH, V_BADGE_HEIGHT, 3, 3, "F");

  // Main background
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, V_BADGE_WIDTH, V_BADGE_HEIGHT, 3, 3, "F");

  // Extended header
  doc.setFillColor(headerColor.r, headerColor.g, headerColor.b);
  doc.roundedRect(x, y, V_BADGE_WIDTH, 20, 3, 3, "F");
  doc.rect(x, y + 14, V_BADGE_WIDTH, 6, "F");

  // Accent stripe
  doc.setFillColor(accentColor.r, accentColor.g, accentColor.b);
  doc.rect(x, y + 20, V_BADGE_WIDTH, 3, "F");

  // Bottom bar
  doc.setFillColor(headerColor.r, headerColor.g, headerColor.b);
  doc.roundedRect(x, y + V_BADGE_HEIGHT - 5, V_BADGE_WIDTH, 5, 0, 0, "F");
  doc.roundedRect(x, y, V_BADGE_WIDTH, V_BADGE_HEIGHT, 3, 3, "S");

  // Company
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");

  if (options.showCompanyLogo && companyLogo) {
    try {
      doc.addImage(companyLogo, "PNG", x + (V_BADGE_WIDTH - 22) / 2, y + 3, 22, 12);
    } catch {
      doc.text(employee.empresa?.nome?.substring(0, 10).toUpperCase() || "ID", x + V_BADGE_WIDTH / 2, y + 12, { align: "center" });
    }
  } else {
    doc.text(employee.empresa?.nome?.substring(0, 10).toUpperCase() || "ID", x + V_BADGE_WIDTH / 2, y + 12, { align: "center" });
  }

  // Photo centered with top margin
  let contentY = y + 27; // Increased top margin

  if (options.showPhoto) {
    const photoSize = 28;
    const photoX = x + (V_BADGE_WIDTH - photoSize) / 2;
    if (employeePhoto) {
      try {
        // Photo shadow
        doc.setFillColor(200, 200, 205);
        doc.roundedRect(photoX + 0.4, contentY + 0.4, photoSize, photoSize, 2, 2, "F");
        // Photo border
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(photoX, contentY, photoSize, photoSize, 2, 2, "F");
        doc.setDrawColor(headerColor.r, headerColor.g, headerColor.b);
        doc.setLineWidth(0.8);
        doc.roundedRect(photoX, contentY, photoSize, photoSize, 2, 2, "D");
        doc.addImage(employeePhoto, "JPEG", photoX + 1, contentY + 1, photoSize - 2, photoSize - 2);
      } catch {
        drawPlaceholderIcon(doc, photoX, contentY, photoSize);
      }
    } else {
      drawPlaceholderIcon(doc, photoX, contentY, photoSize);
    }
    contentY += photoSize + 5;
  }

  // Name centered - only first name
  const centerX = x + V_BADGE_WIDTH / 2;
  doc.setTextColor(25, 25, 35);
  doc.setFont("helvetica", "bold");
  const firstName = employee.nome_completo.split(" ")[0].toUpperCase();
  doc.setFontSize(12);
  doc.text(firstName, centerX, contentY, { align: "center" });
  contentY += 5;

  if (options.showCargo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5);
    doc.setTextColor(90, 90, 100);
    doc.text(employee.cargo.substring(0, 12), centerX, contentY, { align: "center" });
    contentY += 4;
  }

  if (options.showSector && employee.setor) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(headerColor.r, headerColor.g, headerColor.b);
    doc.text(employee.setor.substring(0, 10).toUpperCase(), centerX, contentY, { align: "center" });
  }

  // CPF in bottom bar
  if (options.showCpf && employee.cpf) {
    doc.setFontSize(5);
    doc.setTextColor(255, 255, 255);
    doc.text(employee.cpf, x + V_BADGE_WIDTH / 2, y + V_BADGE_HEIGHT - 1.5, { align: "center" });
  }

  drawCutMarks(doc, x, y, V_BADGE_WIDTH, V_BADGE_HEIGHT);
}

function drawVerticalClassic(
  doc: jsPDF,
  employee: EmployeeForBadge,
  x: number,
  y: number,
  options: BadgeOptions,
  employeePhoto: string | null,
  companyLogo: string | null
) {
  const headerColor = hexToRgb(options.customHeaderColor || options.template.headerColor);

  // Elegant double border
  doc.setFillColor(252, 252, 255);
  doc.setDrawColor(headerColor.r, headerColor.g, headerColor.b);
  doc.setLineWidth(1.2);
  doc.roundedRect(x, y, V_BADGE_WIDTH, V_BADGE_HEIGHT, 2, 2, "FD");
  
  // Inner border
  doc.setLineWidth(0.3);
  doc.roundedRect(x + 2, y + 2, V_BADGE_WIDTH - 4, V_BADGE_HEIGHT - 4, 1.5, 1.5, "D");

  // Header
  doc.setFillColor(headerColor.r, headerColor.g, headerColor.b);
  doc.roundedRect(x + 3, y + 3, V_BADGE_WIDTH - 6, 16, 1.5, 1.5, "F");

  // Accent line
  const lighterColor = {
    r: Math.min(255, headerColor.r + 60),
    g: Math.min(255, headerColor.g + 60),
    b: Math.min(255, headerColor.b + 60)
  };
  doc.setFillColor(lighterColor.r, lighterColor.g, lighterColor.b);
  doc.rect(x + 3, y + 17, V_BADGE_WIDTH - 6, 1.5, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  doc.text(employee.empresa?.nome?.substring(0, 12).toUpperCase() || "CRACHÁ", x + V_BADGE_WIDTH / 2, y + 12, { align: "center" });

  // Content with proper top margin
  let contentY = y + 24; // Increased top margin

  if (options.showPhoto) {
    const photoSize = 26;
    const photoX = x + (V_BADGE_WIDTH - photoSize) / 2;
    if (employeePhoto) {
      try {
        doc.setDrawColor(headerColor.r, headerColor.g, headerColor.b);
        doc.setLineWidth(0.5);
        doc.rect(photoX, contentY, photoSize, photoSize, "D");
        doc.addImage(employeePhoto, "JPEG", photoX + 0.5, contentY + 0.5, photoSize - 1, photoSize - 1);
      } catch {
        drawPlaceholderIcon(doc, photoX, contentY, photoSize);
      }
    } else {
      drawPlaceholderIcon(doc, photoX, contentY, photoSize);
    }
    contentY += photoSize + 5;
  }

  // Name centered - only first name
  const centerX = x + V_BADGE_WIDTH / 2;
  doc.setTextColor(headerColor.r, headerColor.g, headerColor.b);
  doc.setFont("helvetica", "bold");
  const firstName = employee.nome_completo.split(" ")[0].toUpperCase();
  doc.setFontSize(12);
  doc.text(firstName, centerX, contentY, { align: "center" });
  contentY += 5;

  if (options.showCargo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5);
    doc.setTextColor(70, 70, 75);
    doc.text(employee.cargo.substring(0, 12), centerX, contentY, { align: "center" });
    contentY += 4;
  }

  if (options.showSector && employee.setor) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(headerColor.r, headerColor.g, headerColor.b);
    doc.text(employee.setor.substring(0, 10).toUpperCase(), centerX, contentY, { align: "center" });
  }

  if (options.showCpf && employee.cpf) {
    doc.setFontSize(5);
    doc.setTextColor(120, 120, 125);
    doc.text(employee.cpf, x + V_BADGE_WIDTH / 2, y + V_BADGE_HEIGHT - 5, { align: "center" });
  }

  drawCutMarks(doc, x, y, V_BADGE_WIDTH, V_BADGE_HEIGHT);
}

function drawVerticalMinimal(
  doc: jsPDF,
  employee: EmployeeForBadge,
  x: number,
  y: number,
  options: BadgeOptions,
  employeePhoto: string | null,
  companyLogo: string | null
) {
  const headerColor = hexToRgb(options.customHeaderColor || options.template.headerColor);

  // Shadow
  doc.setFillColor(235, 235, 240);
  doc.roundedRect(x + 0.4, y + 0.4, V_BADGE_WIDTH, V_BADGE_HEIGHT, 4, 4, "F");

  // Clean white background
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, V_BADGE_WIDTH, V_BADGE_HEIGHT, 4, 4, "F");

  // Elegant top stripe
  doc.setFillColor(headerColor.r, headerColor.g, headerColor.b);
  doc.roundedRect(x, y, V_BADGE_WIDTH, 6, 4, 4, "F");
  doc.rect(x, y + 4, V_BADGE_WIDTH, 2, "F");

  // Company name
  if (employee.empresa?.nome) {
    doc.setTextColor(headerColor.r, headerColor.g, headerColor.b);
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.text(employee.empresa.nome.substring(0, 12).toUpperCase(), x + V_BADGE_WIDTH / 2, y + 13, { align: "center" });
  }

  // Subtle divider
  doc.setDrawColor(headerColor.r, headerColor.g, headerColor.b);
  doc.setLineWidth(0.2);
  doc.line(x + 8, y + 16, x + V_BADGE_WIDTH - 8, y + 16);

  // Content with proper top margin
  let contentY = y + 21; // Good top margin

  if (options.showPhoto) {
    const photoSize = 28;
    const photoX = x + (V_BADGE_WIDTH - photoSize) / 2;
    if (employeePhoto) {
      try {
        // Circular photo effect
        doc.setFillColor(headerColor.r, headerColor.g, headerColor.b);
        doc.circle(photoX + photoSize / 2, contentY + photoSize / 2, photoSize / 2 + 0.8, "F");
        doc.addImage(employeePhoto, "JPEG", photoX, contentY, photoSize, photoSize);
      } catch {
        doc.setFillColor(240, 240, 245);
        doc.circle(photoX + photoSize / 2, contentY + photoSize / 2, photoSize / 2, "F");
      }
    } else {
      doc.setFillColor(240, 240, 245);
      doc.circle(photoX + photoSize / 2, contentY + photoSize / 2, photoSize / 2, "F");
    }
    contentY += photoSize + 5;
  }

  // Name centered - only first name
  const centerX = x + V_BADGE_WIDTH / 2;
  doc.setTextColor(35, 35, 45);
  doc.setFont("helvetica", "bold");
  const firstName = employee.nome_completo.split(" ")[0].toUpperCase();
  doc.setFontSize(12);
  doc.text(firstName, centerX, contentY, { align: "center" });
  contentY += 5;

  if (options.showCargo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5);
    doc.setTextColor(130, 130, 135);
    doc.text(employee.cargo.substring(0, 12), centerX, contentY, { align: "center" });
    contentY += 4;
  }

  if (options.showSector && employee.setor) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(headerColor.r, headerColor.g, headerColor.b);
    doc.text(employee.setor.substring(0, 9).toUpperCase(), centerX, contentY, { align: "center" });
  }

  if (options.showCpf && employee.cpf) {
    doc.setFontSize(5);
    doc.setTextColor(170, 170, 175);
    doc.text(employee.cpf, x + V_BADGE_WIDTH / 2, y + V_BADGE_HEIGHT - 3, { align: "center" });
  }

  drawCutMarks(doc, x, y, V_BADGE_WIDTH, V_BADGE_HEIGHT);
}

function drawVerticalCorporate(
  doc: jsPDF,
  employee: EmployeeForBadge,
  x: number,
  y: number,
  options: BadgeOptions,
  employeePhoto: string | null,
  companyLogo: string | null
) {
  const headerColor = hexToRgb(options.customHeaderColor || options.template.headerColor);
  const accentColor = hexToRgb(options.template.accentColor);

  // Professional background
  doc.setFillColor(248, 248, 252);
  doc.roundedRect(x, y, V_BADGE_WIDTH, V_BADGE_HEIGHT, 2, 2, "F");

  // Top bar extended
  doc.setFillColor(headerColor.r, headerColor.g, headerColor.b);
  doc.roundedRect(x, y, V_BADGE_WIDTH, 6, 2, 2, "F");
  doc.rect(x, y + 4, V_BADGE_WIDTH, 2, "F");

  // Accent stripe
  doc.setFillColor(accentColor.r, accentColor.g, accentColor.b);
  doc.rect(x, y + 6, V_BADGE_WIDTH, 2, "F");

  // Bottom bar
  doc.setFillColor(headerColor.r, headerColor.g, headerColor.b);
  doc.roundedRect(x, y + V_BADGE_HEIGHT - 6, V_BADGE_WIDTH, 6, 0, 0, "F");
  doc.roundedRect(x, y + V_BADGE_HEIGHT - 6, V_BADGE_WIDTH, 6, 2, 2, "F");
  doc.roundedRect(x, y, V_BADGE_WIDTH, V_BADGE_HEIGHT, 2, 2, "S");

  // Company
  if (employee.empresa?.nome) {
    doc.setTextColor(headerColor.r, headerColor.g, headerColor.b);
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.text(employee.empresa.nome.substring(0, 12).toUpperCase(), x + V_BADGE_WIDTH / 2, y + 14, { align: "center" });
  }

  // Content with proper top margin
  let contentY = y + 20; // Good top margin

  if (options.showPhoto) {
    const photoSize = 26;
    const photoX = x + (V_BADGE_WIDTH - photoSize) / 2;
    if (employeePhoto) {
      try {
        // Professional photo frame
        doc.setFillColor(accentColor.r, accentColor.g, accentColor.b);
        doc.rect(photoX - 1, contentY - 1, photoSize + 2, photoSize + 2, "F");
        doc.addImage(employeePhoto, "JPEG", photoX, contentY, photoSize, photoSize);
      } catch {
        drawPlaceholderIcon(doc, photoX, contentY, photoSize);
      }
    } else {
      drawPlaceholderIcon(doc, photoX, contentY, photoSize);
    }
    contentY += photoSize + 5;
  }

  // Name centered - only first name
  const centerX = x + V_BADGE_WIDTH / 2;
  doc.setTextColor(headerColor.r, headerColor.g, headerColor.b);
  doc.setFont("helvetica", "bold");
  const firstName = employee.nome_completo.split(" ")[0].toUpperCase();
  doc.setFontSize(12);
  doc.text(firstName, centerX, contentY, { align: "center" });
  contentY += 5;

  if (options.showCargo) {
    doc.setTextColor(85, 85, 95);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5);
    doc.text(employee.cargo.substring(0, 12), centerX, contentY, { align: "center" });
    contentY += 4;
  }

  if (options.showSector && employee.setor) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(accentColor.r, accentColor.g, accentColor.b);
    doc.text(employee.setor.substring(0, 9).toUpperCase(), centerX, contentY, { align: "center" });
  }

  // CPF in bottom bar
  if (options.showCpf && employee.cpf) {
    doc.setFontSize(5);
    doc.setTextColor(255, 255, 255);
    doc.text(employee.cpf, x + V_BADGE_WIDTH / 2, y + V_BADGE_HEIGHT - 2, { align: "center" });
  }

  drawCutMarks(doc, x, y, V_BADGE_WIDTH, V_BADGE_HEIGHT);
}

function drawBadge(
  doc: jsPDF,
  employee: EmployeeForBadge,
  x: number,
  y: number,
  options: BadgeOptions,
  employeePhoto: string | null,
  companyLogo: string | null
) {
  const isVertical = options.orientation === "vertical";

  if (isVertical) {
    switch (options.template.style) {
      case "modern":
        drawVerticalModern(doc, employee, x, y, options, employeePhoto, companyLogo);
        break;
      case "classic":
        drawVerticalClassic(doc, employee, x, y, options, employeePhoto, companyLogo);
        break;
      case "minimal":
        drawVerticalMinimal(doc, employee, x, y, options, employeePhoto, companyLogo);
        break;
      case "corporate":
        drawVerticalCorporate(doc, employee, x, y, options, employeePhoto, companyLogo);
        break;
    }
  } else {
    switch (options.template.style) {
      case "modern":
        drawHorizontalModern(doc, employee, x, y, options, employeePhoto, companyLogo);
        break;
      case "classic":
        drawHorizontalClassic(doc, employee, x, y, options, employeePhoto, companyLogo);
        break;
      case "minimal":
        drawHorizontalMinimal(doc, employee, x, y, options, employeePhoto, companyLogo);
        break;
      case "corporate":
        drawHorizontalCorporate(doc, employee, x, y, options, employeePhoto, companyLogo);
        break;
    }
  }
}

export async function generateBadgesPDF(employees: EmployeeForBadge[], options: BadgeOptions): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const imageCache: Map<string, string | null> = new Map();

  for (const employee of employees) {
    if (employee.foto_url && !imageCache.has(employee.foto_url)) {
      const img = await loadImageAsBase64(employee.foto_url);
      imageCache.set(employee.foto_url, img);
    }
    if (employee.empresa?.logo_url && !imageCache.has(employee.empresa.logo_url)) {
      const img = await loadImageAsBase64(employee.empresa.logo_url);
      imageCache.set(employee.empresa.logo_url, img);
    }
  }

  const isVertical = options.orientation === "vertical";
  const badgeWidth = isVertical ? V_BADGE_WIDTH : H_BADGE_WIDTH;
  const badgeHeight = isVertical ? V_BADGE_HEIGHT : H_BADGE_HEIGHT;
  const badgesPerRow = isVertical ? V_BADGES_PER_ROW : H_BADGES_PER_ROW;
  const badgesPerColumn = isVertical ? V_BADGES_PER_COLUMN : H_BADGES_PER_COLUMN;
  const badgesPerPage = badgesPerRow * badgesPerColumn;

  const marginX = (PAGE_WIDTH - badgesPerRow * badgeWidth) / (badgesPerRow + 1);
  const marginY = (PAGE_HEIGHT - badgesPerColumn * badgeHeight) / (badgesPerColumn + 1);

  const totalPages = Math.ceil(employees.length / badgesPerPage);

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) {
      doc.addPage();
    }

    const startIdx = page * badgesPerPage;
    const endIdx = Math.min(startIdx + badgesPerPage, employees.length);

    for (let i = startIdx; i < endIdx; i++) {
      const employee = employees[i];
      const positionOnPage = i - startIdx;
      const col = positionOnPage % badgesPerRow;
      const row = Math.floor(positionOnPage / badgesPerRow);

      const x = marginX + col * (badgeWidth + marginX);
      const y = marginY + row * (badgeHeight + marginY);

      const employeePhoto = options.showPhoto && employee.foto_url ? imageCache.get(employee.foto_url) || null : null;
      const companyLogo = employee.empresa?.logo_url ? imageCache.get(employee.empresa.logo_url) || null : null;

      drawBadge(doc, employee, x, y, options, employeePhoto, companyLogo);
    }
  }

  const fileName = `crachas_${options.orientation}_${todayISO()}.pdf`;
  saveAndBackup(doc, fileName, "Crachas");
}
