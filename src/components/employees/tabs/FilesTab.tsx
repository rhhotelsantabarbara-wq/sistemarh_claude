import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, FileText, Download, Trash2, Loader2, Camera, ScanLine, Crop } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ImageCropper } from "./ImageCropper";
import { dataBR } from "@/lib/date";
interface FilesTabProps {
  employeeId: string;
}

interface EmployeeFile {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  description: string | null;
  created_at: string;
}

const FilesTab = ({ employeeId }: FilesTabProps) => {
  const [files, setFiles] = useState<EmployeeFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showScannerDialog, setShowScannerDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [scannerDescription, setScannerDescription] = useState("");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    fetchFiles();
  }, [employeeId]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const fetchFiles = async () => {
    try {
      const { data, error } = await supabase
        .from("employee_files")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      console.error("Error fetching files:", error);
      toast.error("Erro ao carregar arquivos");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Selecione um arquivo");
      return;
    }

    setUploading(true);
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${employeeId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("employee-files")
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      const { data: { user } } = await supabase.auth.getUser();

      const { error: dbError } = await supabase
        .from("employee_files")
        .insert({
          employee_id: employeeId,
          file_name: selectedFile.name,
          file_path: fileName,
          file_type: selectedFile.type,
          file_size: selectedFile.size,
          description: description || null,
          uploaded_by: user?.id,
        });

      if (dbError) throw dbError;

      toast.success("Arquivo enviado com sucesso");
      setShowUploadDialog(false);
      setSelectedFile(null);
      setDescription("");
      fetchFiles();
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Erro ao enviar arquivo");
    } finally {
      setUploading(false);
    }
  };

  const startCamera = async () => {
    try {
      // Request high resolution camera for better document quality
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment",
          width: { ideal: 3840, min: 1920 },
          height: { ideal: 2160, min: 1080 },
        }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
      
      // Log actual resolution for debugging
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      console.log(`Camera resolution: ${settings.width}x${settings.height}`);
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast.error("Erro ao acessar câmera. Verifique as permissões.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Use full video resolution for high quality capture
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Disable image smoothing for sharper capture
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Use PNG for lossless quality
        const imageData = canvas.toDataURL("image/png");
        setCapturedImage(imageData);
        stopCamera();
        
        console.log(`Captured image: ${canvas.width}x${canvas.height}`);
      }
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setIsCropping(false);
    startCamera();
  };

  const startCropping = () => {
    setIsCropping(true);
  };

  const handleCropComplete = (croppedImage: string) => {
    setCapturedImage(croppedImage);
    setIsCropping(false);
  };

  const cancelCropping = () => {
    setIsCropping(false);
  };

  const handleScannerUpload = async () => {
    if (!capturedImage) {
      toast.error("Capture uma imagem primeiro");
      return;
    }

    setUploading(true);
    try {
      // Convert base64 to blob - keeping PNG for high quality
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      
      // Determine format from the captured image
      const isPng = capturedImage.startsWith("data:image/png");
      const extension = isPng ? "png" : "jpg";
      const contentType = isPng ? "image/png" : "image/jpeg";
      
      const fileName = `${employeeId}/${Date.now()}_scan.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("employee-files")
        .upload(fileName, blob, { contentType });

      if (uploadError) throw uploadError;

      const { data: { user } } = await supabase.auth.getUser();

      const { error: dbError } = await supabase
        .from("employee_files")
        .insert({
          employee_id: employeeId,
          file_name: `Documento_${format(new Date(), "dd-MM-yyyy_HH-mm")}.${extension}`,
          file_path: fileName,
          file_type: contentType,
          file_size: blob.size,
          description: scannerDescription || "Documento escaneado",
          uploaded_by: user?.id,
        });

      if (dbError) throw dbError;

      toast.success("Documento escaneado e salvo com sucesso");
      closeScannerDialog();
      fetchFiles();
    } catch (error) {
      console.error("Error uploading scanned file:", error);
      toast.error("Erro ao salvar documento escaneado");
    } finally {
      setUploading(false);
    }
  };

  const closeScannerDialog = () => {
    stopCamera();
    setCapturedImage(null);
    setScannerDescription("");
    setIsCropping(false);
    setShowScannerDialog(false);
  };

  const handleDownload = async (file: EmployeeFile) => {
    try {
      const { data, error } = await supabase.storage
        .from("employee-files")
        .download(file.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Download concluído");
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Erro ao baixar arquivo");
    }
  };

  const handleDelete = async (file: EmployeeFile) => {
    if (!confirm("Tem certeza que deseja excluir este arquivo?")) return;

    try {
      const { error: storageError } = await supabase.storage
        .from("employee-files")
        .remove([file.file_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from("employee_files")
        .delete()
        .eq("id", file.id);

      if (dbError) throw dbError;

      toast.success("Arquivo excluído com sucesso");
      fetchFiles();
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error("Erro ao excluir arquivo");
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "—";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="text-lg">Arquivos do Funcionário</CardTitle>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => {
              setShowScannerDialog(true);
              setTimeout(() => startCamera(), 100);
            }}>
              <ScanLine className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="text-xs sm:text-sm">Scanner</span>
            </Button>
            <Button size="sm" className="flex-1 sm:flex-none" onClick={() => setShowUploadDialog(true)}>
              <Upload className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="text-xs sm:text-sm">Enviar</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum arquivo cadastrado
            </p>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-accent/50 transition-colors gap-3"
                >
                  <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                    <FileText className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5 sm:mt-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm sm:text-base break-words">{file.file_name}</p>
                      {file.description && (
                        <p className="text-xs sm:text-sm text-muted-foreground break-words">
                          {file.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {format(dataBR(file.created_at), "dd/MM/yyyy HH:mm")} •{" "}
                        {formatFileSize(file.file_size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 self-end sm:self-auto shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(file)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(file)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Arquivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="file">Arquivo</Label>
              <Input
                id="file"
                type="file"
                onChange={handleFileSelect}
                accept="image/*,.pdf,.doc,.docx"
              />
            </div>
            <div>
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Foto do RG, Comprovante de residência..."
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowUploadDialog(false);
                  setSelectedFile(null);
                  setDescription("");
                }}
                disabled={uploading}
              >
                Cancelar
              </Button>
              <Button onClick={handleUpload} disabled={uploading || !selectedFile}>
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Enviar
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Scanner Dialog */}
      <Dialog open={showScannerDialog} onOpenChange={(open) => {
        if (!open) closeScannerDialog();
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="w-5 h-5" />
              Scanner de Documento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isCropping && capturedImage ? (
              <ImageCropper
                imageSrc={capturedImage}
                onCropComplete={handleCropComplete}
                onCancel={cancelCropping}
              />
            ) : (
              <>
                {/* Camera/Preview Area */}
                <div className="relative bg-muted rounded-lg overflow-hidden aspect-[4/3]">
                  {!capturedImage ? (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                      />
                      {!isCameraActive && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center text-muted-foreground">
                            <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>Carregando câmera...</p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <img
                      src={capturedImage}
                      alt="Documento capturado"
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>

                <canvas ref={canvasRef} className="hidden" />

                {/* Capture/Retake Buttons */}
                {!capturedImage ? (
                  <Button
                    onClick={capturePhoto}
                    disabled={!isCameraActive}
                    className="w-full"
                    size="lg"
                  >
                    <Camera className="w-5 h-5 mr-2" />
                    Capturar Documento
                  </Button>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="scannerDescription">Descrição (opcional)</Label>
                      <Textarea
                        id="scannerDescription"
                        value={scannerDescription}
                        onChange={(e) => setScannerDescription(e.target.value)}
                        placeholder="Ex: RG frente, CNH, Comprovante..."
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        onClick={retakePhoto}
                        disabled={uploading}
                        className="flex-1 min-w-[100px]"
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        Nova Captura
                      </Button>
                      <Button
                        variant="outline"
                        onClick={startCropping}
                        disabled={uploading}
                        className="flex-1 min-w-[100px]"
                      >
                        <Crop className="w-4 h-4 mr-2" />
                        Recortar
                      </Button>
                      <Button
                        onClick={handleScannerUpload}
                        disabled={uploading}
                        className="flex-1 min-w-[100px]"
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Salvar
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}

                <Button
                  variant="ghost"
                  onClick={closeScannerDialog}
                  disabled={uploading}
                  className="w-full"
                >
                  Cancelar
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FilesTab;
