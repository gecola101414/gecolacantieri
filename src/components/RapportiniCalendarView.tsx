import React, { useState, useMemo } from 'react';
import { Rapportino, Cantiere, UserAccount } from '../types';
import { 
  Calendar, ChevronLeft, ChevronRight, Clock, Plus, Lock, Unlock, 
  CheckCircle2, AlertCircle, AlertTriangle, User, Building2, History,
  FileText, Camera, Edit3, X, Eye
} from 'lucide-react';

interface RapportiniCalendarViewProps {
  rapportini: Rapportino[];
  cantieri: Cantiere[];
  currentUser: UserAccount;
  onSelectRapportino: (r: Rapportino) => void;
  onCreateForDate?: (dateStr: string, cantiereId?: string) => void;
  onToggleLockAccounting?: (rapportinoId: string, lock: boolean) => Promise<void>;
  onEditRapportino?: (r: Rapportino) => void;
}

export const RapportiniCalendarView: React.FC<RapportiniCalendarViewProps> = ({
  rapportini,
  cantieri,
  currentUser,
  onSelectRapportino,
  onCreateForDate,
  onToggleLockAccounting,
  onEditRapportino,
}) => {
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth()); // 0-11
  const [selectedCantiereFilter, setSelectedCantiereFilter] = useState<string>('all');
  const [selectedDateDetail, setSelectedDateDetail] = useState<string | null>(null);

  // Month navigation
  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const monthNames = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  const daysOfWeek = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  // Filtered rapportini by cantiere
  const filteredRapportini = useMemo(() => {
    return rapportini.filter((r) => {
      if (selectedCantiereFilter !== 'all' && r.cantiereId !== selectedCantiereFilter) {
        return false;
      }
      return true;
    });
  }, [rapportini, selectedCantiereFilter]);

  // Calendar cells generation for current month
  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

    // Day of week: 0 is Sun, 1 is Mon... convert to Monday=0, Sunday=6
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const totalDays = lastDayOfMonth.getDate();
    const cells: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isWorkday: boolean;
      rapportini: Rapportino[];
      hasValido: boolean;
      hasMissing: boolean;
    }> = [];

    // Empty padding cells before first day
    for (let i = 0; i < startDayOfWeek; i++) {
      cells.push({
        dateStr: '',
        dayNum: 0,
        isCurrentMonth: false,
        isWorkday: false,
        rapportini: [],
        hasValido: false,
        hasMissing: false,
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Days of this month
    for (let d = 1; d <= totalDays; d++) {
      const monthStr = String(currentMonth + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const dateStr = `${currentYear}-${monthStr}-${dayStr}`;

      const dateObj = new Date(currentYear, currentMonth, d);
      const dayOfWeek = dateObj.getDay(); // 0 is Sun, 6 is Sat
      const isWorkday = dayOfWeek >= 1 && dayOfWeek <= 5; // Lunedì-Venerdì

      const dayRapportini = filteredRapportini.filter((r) => r.date === dateStr);
      const hasValido = dayRapportini.some((r) => r.status !== 'annullato');
      const isPastOrToday = dateStr <= todayStr;
      const hasMissing = isWorkday && isPastOrToday && !hasValido;

      cells.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isWorkday,
        rapportini: dayRapportini,
        hasValido,
        hasMissing,
      });
    }

    return cells;
  }, [currentYear, currentMonth, filteredRapportini]);

  // Missing days summary count in this month
  const missingDaysCount = useMemo(() => {
    return calendarCells.filter((c) => c.isCurrentMonth && c.hasMissing).length;
  }, [calendarCells]);

  const totalLoadedThisMonth = useMemo(() => {
    return calendarCells.reduce((acc, c) => acc + c.rapportini.length, 0);
  }, [calendarCells]);

  const canManageAccounting = currentUser.role === 'admin' || currentUser.role === 'amministrativo_contabile';

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header & Navigation Bar */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Calendario Catalogazione Rapportini
            </h3>
            <span className="bg-blue-100 text-blue-900 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Controllo Giornaliero
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Vista a calendario mensile con tracciabilità della data e ora effettiva di compilazione, giorni saltati da completare e blocco contabilità.
          </p>
        </div>

        {/* Month Selector Buttons */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={prevMonth}
              className="p-2 hover:bg-white text-slate-700 rounded-xl transition cursor-pointer shadow-xs"
              title="Mese precedente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-black px-3 text-slate-900 min-w-[140px] text-center">
              {monthNames[currentMonth]} {currentYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-2 hover:bg-white text-slate-700 rounded-xl transition cursor-pointer shadow-xs"
              title="Mese successivo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <select
            value={selectedCantiereFilter}
            onChange={(e) => setSelectedCantiereFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs font-bold rounded-2xl px-3.5 py-2.5 text-slate-800 outline-none focus:border-amber-500"
          >
            <option value="all">Tutti i Cantieri</option>
            {cantieri.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
              Rapportini Caricati ({monthNames[currentMonth]})
            </span>
            <p className="text-2xl font-black text-slate-900">{totalLoadedThisMonth}</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
              Giornate Mancanti da Completare
            </span>
            <p className={`text-2xl font-black ${missingDaysCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {missingDaysCount}
            </p>
          </div>
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
            missingDaysCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
          }`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
              Bloccati in Contabilità
            </span>
            <p className="text-2xl font-black text-indigo-700">
              {filteredRapportini.filter((r) => r.lockedForAccounting).length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Lock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden p-4 sm:p-6 space-y-4">
        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center">
          {daysOfWeek.map((day) => (
            <div
              key={day}
              className="py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-400 bg-slate-50 rounded-xl"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days cells grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {calendarCells.map((cell, idx) => {
            if (!cell.isCurrentMonth) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="min-h-[90px] sm:min-h-[115px] bg-slate-50/40 rounded-2xl border border-dashed border-slate-100"
                />
              );
            }

            const isToday = cell.dateStr === new Date().toISOString().split('T')[0];

            return (
              <div
                key={cell.dateStr}
                onClick={() => setSelectedDateDetail(cell.dateStr)}
                className={`min-h-[95px] sm:min-h-[120px] rounded-2xl p-2 sm:p-2.5 border transition-all flex flex-col justify-between cursor-pointer relative group ${
                  isToday
                    ? 'border-amber-400 bg-amber-50/20 shadow-xs'
                    : cell.hasMissing
                    ? 'border-amber-200 bg-amber-50/15 hover:border-amber-300'
                    : cell.hasValido
                    ? 'border-emerald-200/80 bg-emerald-50/10 hover:border-emerald-300'
                    : 'border-slate-200/80 bg-white hover:border-slate-300'
                }`}
              >
                {/* Cell Header: Day Number and status badge */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-black rounded-lg px-1.5 py-0.5 ${
                      isToday
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'text-slate-800'
                    }`}
                  >
                    {cell.dayNum}
                  </span>

                  {cell.hasMissing && (
                    <span className="text-[9px] font-extrabold text-amber-700 bg-amber-100 border border-amber-300 rounded px-1 py-0.2 shrink-0 flex items-center gap-0.5">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      <span className="hidden sm:inline">Mancante</span>
                    </span>
                  )}
                </div>

                {/* Rapportini Pills in this cell */}
                <div className="space-y-1 my-1 overflow-y-auto max-h-[60px] custom-scrollbar">
                  {cell.rapportini.map((r) => {
                    const isLocked = r.lockedForAccounting;
                    const isAnnullato = r.status === 'annullato';

                    return (
                      <div
                        key={r.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectRapportino(r);
                        }}
                        className={`p-1 rounded-lg text-[10px] font-bold flex items-center justify-between gap-1 transition truncate ${
                          isAnnullato
                            ? 'bg-rose-100 text-rose-800 line-through opacity-70'
                            : isLocked
                            ? 'bg-indigo-100 text-indigo-900 border border-indigo-200 font-black'
                            : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                        }`}
                        title={`${r.codiceRapportino || 'N° ' + r.numeroProgressivo} - ${r.userName} (Compilato il ${r.compilatoIl || r.ora || r.submittedAt || r.date})`}
                      >
                        <span className="truncate">
                          {r.numeroProgressivo ? `N°${r.numeroProgressivo}` : 'Rap'} • {r.userName.split(' ')[0]}
                        </span>
                        {isLocked && <Lock className="w-2.5 h-2.5 shrink-0 text-indigo-700" />}
                      </div>
                    );
                  })}
                </div>

                {/* Quick Add Button on Hover or when missing */}
                {onCreateForDate && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateForDate(cell.dateStr, selectedCantiereFilter !== 'all' ? selectedCantiereFilter : undefined);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-[10px] font-black text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg py-1 px-1.5 flex items-center justify-center gap-1 transition cursor-pointer w-full mt-auto"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Carica</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Date Detail Modal */}
      {selectedDateDetail && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-5 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-black text-slate-900">
                  Rapportini del {selectedDateDetail}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDateDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List of rapportini for selected date */}
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {filteredRapportini.filter((r) => r.date === selectedDateDetail).length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">Nessun rapportino per questa data.</p>
                  <p className="text-[11px] text-slate-500">
                    Puoi completare questo giorno in ritardo con calma: il sistema manterrà traccia dell'orario di effettiva compilazione.
                  </p>
                  {onCreateForDate && (
                    <button
                      type="button"
                      onClick={() => {
                        const d = selectedDateDetail;
                        setSelectedDateDetail(null);
                        onCreateForDate(d, selectedCantiereFilter !== 'all' ? selectedCantiereFilter : undefined);
                      }}
                      className="mt-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black px-4 py-2 rounded-xl transition cursor-pointer shadow-sm"
                    >
                      + Compila Rapportino per il {selectedDateDetail}
                    </button>
                  )}
                </div>
              ) : (
                filteredRapportini
                  .filter((r) => r.date === selectedDateDetail)
                  .map((r) => {
                    const cantiereObj = cantieri.find((c) => c.id === r.cantiereId);
                    const isLocked = r.lockedForAccounting;

                    return (
                      <div
                        key={r.id}
                        className={`p-4 rounded-2xl border space-y-3 ${
                          isLocked
                            ? 'bg-indigo-50/50 border-indigo-200'
                            : r.status === 'annullato'
                            ? 'bg-rose-50/40 border-rose-200'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-slate-900">
                              {r.codiceRapportino || `N° ${r.numeroProgressivo}`}
                            </span>
                            <span className="text-xs font-bold text-slate-700">
                              • {cantiereObj?.name || 'Cantiere'}
                            </span>
                          </div>

                          {isLocked ? (
                            <span className="bg-indigo-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Bloccato in Contabilità
                            </span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-full">
                              Valido
                            </span>
                          )}
                        </div>

                        {/* Audit Details */}
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 text-xs space-y-1">
                          <div className="flex items-center justify-between text-slate-600">
                            <span>Compilatore: <strong>{r.userName}</strong></span>
                            <span className="font-mono text-[11px]">Ora: {r.ora || 'N/D'}</span>
                          </div>
                          {r.compilatoIl && (
                            <p className="text-[11px] text-amber-700 font-medium">
                              🕒 Traccia Compilazione Effettiva: <strong>{r.compilatoIl}</strong>
                            </p>
                          )}
                          {isLocked && r.lockedAt && (
                            <p className="text-[11px] text-indigo-700 font-medium">
                              🔒 Bloccato da {r.lockedBy || 'Amministrazione'} il {r.lockedAt}
                            </p>
                          )}
                          {r.note && <p className="text-slate-600 italic mt-1">"{r.note}"</p>}
                        </div>

                        {/* Edit History Trail */}
                        {r.editHistory && r.editHistory.length > 0 && (
                          <div className="space-y-1 pt-1 border-t border-slate-100">
                            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                              <History className="w-3 h-3" /> Storico Modifiche:
                            </span>
                            {r.editHistory.map((h, hIdx) => (
                              <p key={hIdx} className="text-[10px] text-slate-600 bg-white p-1.5 rounded border border-slate-200">
                                Modificato il <strong>{h.editedAt}</strong> da <strong>{h.editedBy}</strong>: {h.changesSummary}
                              </p>
                            ))}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDateDetail(null);
                              onSelectRapportino(r);
                            }}
                            className="text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Vedi Scheda Completa</span>
                          </button>

                          <div className="flex items-center gap-2">
                            {/* Accounting Lock toggle for Admin */}
                            {canManageAccounting && onToggleLockAccounting && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await onToggleLockAccounting(r.id, !isLocked);
                                }}
                                className={`text-xs font-black px-3 py-1.5 rounded-xl flex items-center gap-1 transition cursor-pointer ${
                                  isLocked
                                    ? 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200'
                                    : 'bg-slate-900 text-white hover:bg-slate-800'
                                }`}
                              >
                                {isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                                <span>{isLocked ? 'Sblocca Contabilità' : 'Blocca in Contabilità'}</span>
                              </button>
                            )}

                            {/* Edit Button */}
                            {onEditRapportino && !isLocked && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDateDetail(null);
                                  onEditRapportino(r);
                                }}
                                className="text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1.5 rounded-xl flex items-center gap-1 transition cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Modifica</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
