import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RotateCw, Check, X } from "lucide-react";

interface Props {
  onCapture: (dataUrl: string) => void;
  onCancel?: () => void;
}

export function SelfieCapture({ onCapture, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setError(null);
    setCaptured(null);
    setReady(false);
    stop();
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "user" }, width: { ideal: 960 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = s;
      const v = videoRef.current;
      if (v) {
        v.srcObject = s;
        // Só libera o botão quando a câmera já está mostrando imagem (evita foto preta)
        const liberar = () => { if (v.videoWidth > 0) setReady(true); };
        v.onloadeddata = liberar;
        v.onplaying = liberar;
        await v.play().catch(() => { /* alguns celulares tocam sozinhos pelo autoPlay */ });
        liberar();
      }
    } catch (e) {
      setError(
        "Não foi possível acessar a câmera. Permita o acesso à câmera nas configurações do navegador e tente novamente.",
      );
    }
  }
  function stop() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  /** Desenha o quadro atual; devolve null se a imagem saiu escura demais (câmera ainda iniciando) */
  function desenhar(): string | null {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const vw = v.videoWidth;
    const vh = v.videoHeight;

    // Recorte vertical 3:4 centralizado (funciona com a câmera em pé ou deitada)
    let cropW = vw, cropH = Math.round(vw / 0.75);
    if (cropH > vh) { cropH = vh; cropW = Math.round(vh * 0.75); }
    const cropX = Math.round((vw - cropW) / 2);
    const cropY = Math.round((vh - cropH) / 2);

    const outW = 480;
    const outH = 640;
    const c = document.createElement("canvas");
    c.width = outW;
    c.height = outH;
    const ctx = c.getContext("2d")!;

    // Fundo branco (fundo transparente vira preto no PDF assinado)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outW, outH);

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(outW / 2, outH / 2, outW / 2, outH / 2, 0, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    // Espelha (selfie)
    ctx.translate(outW, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, cropX, cropY, cropW, cropH, 0, 0, outW, outH);
    ctx.restore();

    // Confere o brilho no centro da foto
    const px = ctx.getImageData(outW / 2 - 60, outH / 2 - 80, 120, 160).data;
    let soma = 0;
    for (let i = 0; i < px.length; i += 16) soma += px[i] + px[i + 1] + px[i + 2];
    const media = soma / (px.length / 16) / 3;
    if (media < 12) return null;
    return c.toDataURL("image/jpeg", 0.9);
  }

  async function tirar() {
    // Tenta algumas vezes: em alguns celulares os primeiros quadros saem pretos
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const url = desenhar();
      if (url) {
        setCaptured(url);
        stop();
        return;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    setError("A foto saiu escura. Procure um lugar mais claro, confira se nada cobre a câmera e tente de novo.");
  }

  function confirmar() {
    if (captured) onCapture(captured);
  }

  function refazer() {
    setCaptured(null);
    start();
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="relative overflow-hidden rounded-lg border bg-black aspect-[3/4] max-w-sm mx-auto flex items-center justify-center">
        {/* O vídeo fica sempre na tela (só escondido depois da foto) para o "Refazer" funcionar */}
        <video
          ref={videoRef}
          className={`w-full h-full object-cover ${captured ? "hidden" : ""}`}
          style={{ transform: "scaleX(-1)" }}
          autoPlay
          playsInline
          muted
        />
        {captured ? (
          <img src={captured} alt="Selfie" className="absolute inset-0 w-full h-full object-contain bg-white" />
        ) : (
          <>
            {/* Overlay com guia oval para enquadrar o rosto */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 300 400"
              preserveAspectRatio="none"
            >
              <defs>
                <mask id="oval-mask">
                  <rect width="300" height="400" fill="white" />
                  <ellipse cx="150" cy="200" rx="120" ry="160" fill="black" />
                </mask>
              </defs>
              <rect width="300" height="400" fill="rgba(0,0,0,0.55)" mask="url(#oval-mask)" />
              <ellipse
                cx="150"
                cy="200"
                rx="120"
                ry="160"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeDasharray="6 6"
              />
            </svg>
            <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-white drop-shadow">
              Posicione seu rosto dentro do oval
            </p>
          </>
        )}
      </div>
      <div className="flex gap-2">
        {!captured ? (
          <>
            <Button
              type="button"
              onClick={tirar}
              disabled={!ready}
              className="flex-1"
            >
              <Camera className="w-4 h-4 mr-2" />
              {ready ? "Capturar selfie" : "Abrindo câmera…"}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            )}
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={refazer}
              className="flex-1"
            >
              <RotateCw className="w-4 h-4 mr-2" /> Refazer
            </Button>
            <Button type="button" onClick={confirmar} className="flex-1">
              <Check className="w-4 h-4 mr-2" /> Usar esta selfie
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
