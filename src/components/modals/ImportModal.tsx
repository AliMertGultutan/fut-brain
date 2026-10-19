import React, { useState } from 'react';
import { ClubDataProvider } from '../../services/providers.ts';
import type { Player } from '../../types/index.ts';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedPlayers: Player[], summary?: { importedCount: number; errorCount: number }) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [importFormat, setImportFormat] = useState<'json' | 'csv'>('json');
  const [rawText, setRawText] = useState('');
  const [resultMessage, setResultMessage] = useState<{
    type: 'success' | 'error';
    text: string;
    errors?: string[];
  } | null>(null);

  if (!isOpen) return null;

  const handleImport = () => {
    if (!rawText.trim()) {
      setResultMessage({
        type: 'error',
        text: 'Lütfen içe aktarılacak JSON veya CSV metnini yapıştırın veya yükleyin.',
      });
      return;
    }

    const result = ClubDataProvider.importData(rawText, importFormat);
    if (result.success) {
      setResultMessage({
        type: 'success',
        text: `Başarıyla ${result.importedCount} oyuncu kulübe eklendi/güncellendi!`,
        errors: result.errors,
      });
      onSuccess(result.updatedPlayers, { importedCount: result.importedCount, errorCount: result.errorCount });
    } else {
      setResultMessage({
        type: 'error',
        text: 'İçe aktarma sırasında hata oluştu.',
        errors: result.errors,
      });
    }
  };

  const loadSample = (format: 'json' | 'csv') => {
    setImportFormat(format);
    if (format === 'json') {
      const sample = [
        {
          name: 'Federico Chiesa',
          rating: 84,
          position: 'RW',
          club: 'Liverpool',
          league: 'Premier League',
          nation: 'İtalya',
          isUntradeable: true,
          price: 6800,
        },
        {
          name: 'Manuel Neuer',
          rating: 87,
          position: 'GK',
          club: 'Bayern München',
          league: 'Bundesliga',
          nation: 'Almanya',
          isUntradeable: true,
          price: 25000,
        },
      ];
      setRawText(JSON.stringify(sample, null, 2));
    } else {
      const sample = `name,rating,position,club,price
Harry Kane,90,ST,Bayern München,45000
Lautaro Martinez,89,ST,Inter,36000
Bernardo Silva,88,CM,Man City,30000`;
      setRawText(sample);
    }
    setResultMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-container-lowest/80 backdrop-blur-sm p-4">
      <div className="bg-surface-container-low border border-surface-container-highest/60 rounded-xl w-full max-w-xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-space-md border-b border-surface-container-highest/40 flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-primary-fixed text-2xl">upload_file</span>
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                Kulüp Verisi İçe Aktar
              </h3>
              <span className="font-data-sm text-data-sm text-outline">
                CSV veya JSON formatında oyuncu envanterinizi yükleyin
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-surface-container-high text-outline hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Format Selector & Sample buttons */}
        <div className="p-space-md flex flex-col gap-space-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center bg-surface-container p-1 rounded-lg">
              <button
                onClick={() => setImportFormat('json')}
                className={`px-3 py-1 rounded font-label-md text-label-md transition-all ${
                  importFormat === 'json'
                    ? 'bg-primary-container text-on-primary-container font-bold shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                JSON Formatı
              </button>
              <button
                onClick={() => setImportFormat('csv')}
                className={`px-3 py-1 rounded font-label-md text-label-md transition-all ${
                  importFormat === 'csv'
                    ? 'bg-primary-container text-on-primary-container font-bold shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                CSV Formatı
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => loadSample(importFormat)}
                className="px-2.5 py-1 rounded bg-surface-container text-secondary hover:bg-surface-container-high font-data-sm text-data-sm flex items-center gap-1 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">content_paste</span>
                Örnek {importFormat.toUpperCase()} Yükle
              </button>
            </div>
          </div>

          <textarea
            rows={8}
            className="w-full bg-surface-container border border-surface-container-highest/60 rounded-lg p-3 font-data-sm text-data-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary-fixed focus:ring-0 resize-none font-mono"
            placeholder={
              importFormat === 'json'
                ? '[{"name": "Oyuncu Adı", "rating": 86, "position": "CB", "isUntradeable": true}]'
                : 'name,rating,position,club,price\nHaaland,91,ST,Man City,65000'
            }
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />

          {resultMessage && (
            <div
              className={`p-space-sm rounded-lg border text-body-sm flex flex-col gap-1 ${
                resultMessage.type === 'success'
                  ? 'bg-primary-container/10 border-primary-fixed/40 text-primary-fixed'
                  : 'bg-error-container/20 border-error/40 text-error'
              }`}
            >
              <div className="flex items-center gap-2 font-bold">
                <span className="material-symbols-outlined text-base">
                  {resultMessage.type === 'success' ? 'check_circle' : 'error'}
                </span>
                <span>{resultMessage.text}</span>
              </div>
              {resultMessage.errors && resultMessage.errors.length > 0 && (
                <ul className="list-disc list-inside text-outline text-data-sm pl-2">
                  {resultMessage.errors.slice(0, 5).map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                  {resultMessage.errors.length > 5 && (
                    <li>...ve {resultMessage.errors.length - 5} diğer hata</li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-space-md border-t border-surface-container-highest/40 bg-surface-container-lowest flex items-center justify-between">
          <span className="font-data-sm text-data-sm text-outline">
            EA Web App şifre veya oturum çerezi gerektirmez
          </span>
          <div className="flex items-center gap-space-sm">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors"
            >
              İptal
            </button>
            <button
              onClick={handleImport}
              className="px-5 py-2 rounded bg-primary-container text-on-primary-container font-headline-sm text-headline-sm font-bold hover:brightness-105 transition-all shadow-md flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">save</span>
              <span>İçe Aktar ve Kaydet</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
