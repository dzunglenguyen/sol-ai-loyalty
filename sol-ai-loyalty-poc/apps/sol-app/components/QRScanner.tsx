"use client";

import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner, Html5Qrcode } from "html5-qrcode";
import jsQR from "jsqr";
import { logToServer } from "@/app/actions/logger";

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (error: string) => void;
}

export default function QRScanner({ onScanSuccess, onScanError }: QRScannerProps) {
  const [isCameraMode, setIsCameraMode] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (isCameraMode) {
      if (typeof window !== "undefined" && !scannerRef.current) {
        scannerRef.current = new Html5QrcodeScanner(
          "qr-reader",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          /* verbose= */ false
        );
        scannerRef.current.render(
          (decodedText) => {
            console.log("Camera Scan Success:", decodedText);
            onScanSuccess(decodedText);
            scannerRef.current?.clear().catch(() => {});
          },
          (err) => {
            // Silently handle scan errors (e.g. no QR in frame)
          }
        );
      }
    } else {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [isCameraMode, onScanSuccess]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    console.log("--- Bắt đầu quét file QR ---");
    console.log("File name:", selectedFile.name);
    console.log("File type:", selectedFile.type);
    console.log("File size:", (selectedFile.size / 1024).toFixed(2), "KB");

    setFile(selectedFile);
    setIsScanning(true);
    
    // Sử dụng jsQR để quét vì nó ổn định hơn cho ảnh tĩnh
    const reader = new FileReader();
    reader.onload = async (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setIsScanning(false);
          return;
        }

        // Tối ưu kích thước ảnh nếu quá lớn để jsQR xử lý tốt hơn
        const MAX_SIZE = 1000;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);
        console.log("Đang phân tích dữ liệu ảnh (ImageData)... size:", width, "x", height);
        
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code) {
          logToServer("jsQR Scan Success", { data: code.data });
          onScanSuccess(code.data);
        } else {
          logToServer("jsQR Scan Failed - Falling back to html5-qrcode");
          // Fallback sang html5-qrcode scanFile nếu jsQR thất bại
          tryScanWithHtml5Qrcode(selectedFile);
        }
        setIsScanning(false);
      };
      img.onerror = () => {
        setIsScanning(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(selectedFile);
  };

  const tryScanWithHtml5Qrcode = async (selectedFile: File) => {
    console.log("Đang thử quét fallback bằng html5-qrcode...");
    if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("qr-reader-file", { verbose: false });
    }
    try {
      const decodedText = await html5QrCodeRef.current.scanFile(selectedFile, false);
      logToServer("html5-qrcode Fallback Success", { data: decodedText });
      onScanSuccess(decodedText);
    } catch (err) {
      logToServer("QR Scan Failed Completely", { error: String(err) });
      if (onScanError) {
        onScanError("Không tìm thấy mã QR. Hãy thử chụp ảnh gần hơn hoặc dùng ảnh rõ nét hơn.");
      }
    }
  };

  return (
    <div className="flex flex-col items-center w-full gap-4">
      <div className="flex bg-gray-100 p-1 rounded-pill w-full max-w-xs mb-4">
        <button
          className={`flex-1 py-2 text-sm font-semibold rounded-pill transition-all ${
            isCameraMode ? "bg-white shadow-sm text-[#0046BE]" : "text-gray-500"
          }`}
          onClick={() => setIsCameraMode(true)}
        >
          Camera
        </button>
        <button
          className={`flex-1 py-2 text-sm font-semibold rounded-pill transition-all ${
            !isCameraMode ? "bg-white shadow-sm text-[#0046BE]" : "text-gray-500"
          }`}
          onClick={() => setIsCameraMode(false)}
        >
          Tải ảnh lên
        </button>
      </div>

      {isCameraMode ? (
        <div id="qr-reader" className="w-full max-w-md overflow-hidden rounded-xl border-2 border-dashed border-gray-300" />
      ) : (
        <div className="w-full max-w-md p-8 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center bg-white relative min-h-[300px] justify-center text-center">
          <div id="qr-reader-file" style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: '250px', height: '250px' }} />
          
          <p className="text-gray-500 text-sm mb-4">
            Chọn một ảnh chứa mã QR để quét
          </p>
          
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            id="qr-file-input"
          />
          
          <label
            htmlFor="qr-file-input"
            className={`px-6 py-2 bg-[#0046BE] text-white rounded-pill font-medium cursor-pointer hover:opacity-90 transition-all ${
              isScanning ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            {isScanning ? "Đang xử lý..." : "Chọn ảnh từ thư viện"}
          </label>
          
          {file && <p className="mt-2 text-xs text-gray-400">{file.name}</p>}
          
          {isScanning && (
            <div className="mt-4 flex items-center justify-center gap-2 text-[#0046BE] text-sm animate-pulse">
              <span className="w-2 h-2 bg-[#0046BE] rounded-full animate-bounce"></span>
              Đang phân tích hình ảnh...
            </div>
          )}

          <div className="mt-6 p-4 bg-blue-50 rounded-lg text-[11px] text-[#0046BE] leading-relaxed">
            <strong>Mẹo:</strong> Hãy mở console (F12) để xem chi tiết log lỗi nếu không nhận diện được mã.
          </div>
        </div>
      )}
      
      <style jsx global>{`
        #qr-reader {
          border: none !important;
        }
        #qr-reader img {
          display: none !important;
        }
        #qr-reader__dashboard {
          padding: 20px !important;
        }
        #qr-reader__camera_selection {
          width: 100%;
          margin-bottom: 10px;
          padding: 8px;
          border-radius: 8px;
          border: 1px solid #ddd;
        }
        #qr-reader__dashboard_section_csr button {
          padding: 8px 16px;
          background-color: #0046BE;
          color: white;
          border-radius: 20px;
          border: none;
          font-weight: 500;
          margin: 5px;
        }
      `}</style>
    </div>
  );
}
