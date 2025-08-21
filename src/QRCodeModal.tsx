import * as qrcode from "qrcode.react";
import { createPortal } from "react-dom";

interface QRCodeModalProps {
  url: string;
  title: string;
  onClose: () => void;
}

export default function QRCodeModal({ url, title, onClose }: QRCodeModalProps) {
  const handlePrint = () => {
    const printableArea = document.querySelector(".printable-area");
    if (!printableArea) return;

    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            @media print {
              body {
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                height: 100%;
                margin: 0;
                padding: 0;
              }
              .printable-area {
                text-align: center;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="printable-area">
            <h2 style="font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem;">${title}</h2>
            <div style="display: inline-block; margin: 1.5rem 0;">
              ${
                // This is a bit of a hack to get the canvas data URL
                (
                  document.querySelector(
                    ".printable-area canvas"
                  ) as HTMLCanvasElement
                )?.toDataURL()
                  ? `<img src="${(
                      document.querySelector(
                        ".printable-area canvas"
                      ) as HTMLCanvasElement
                    ).toDataURL()}" />`
                  : ""
              }
            </div>
          </div>
        </body>
      </html>
    `);
    doc.close();

    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();

    // Clean up after a short delay
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 500);
  };

  const modalComponent = (
    // Modal backdrop
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"
      onClick={onClose}
    >
      {/* Modal content container, designated as the printable area */}
      <div
        className="bg-white p-8 rounded-lg shadow-xl w-full max-w-xs text-center printable-area"
        onClick={(e) => e.stopPropagation()}
      >
        {/* The file name is used as the title */}
        <h2 className="text-2xl font-bold mb-4">{title}</h2>

        {/* The QR code is centered below the title */}
        <div className="my-6 inline-block">
          <qrcode.QRCodeCanvas value={url} size={220} />
        </div>

        {/* Container for buttons, hidden from printing */}
        <div className="flex flex-col gap-2 no-print">
          {/* Prominent print button */}
          <button
            onClick={handlePrint}
            className="w-full bg-primary text-white py-2 rounded-md font-semibold hover:bg-primary-hover transition-colors"
          >
            Print
          </button>
          {/* Close button */}
          <button
            onClick={onClose}
            className="w-full bg-gray-200 text-gray-700 py-2 rounded-md font-semibold hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalComponent, document.body);
}
