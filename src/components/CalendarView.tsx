import React, { useState, useMemo } from 'react';
import { Note, AppEvent, AppTask } from '../types';
import { COLOR_CLASSES } from '../data/initialNotes';
import {
  ChevronLeft, ChevronRight,
  CalendarDays, CalendarRange, Calendar as CalendarIcon,
  Bell, CalendarClock, ListTodo, Clock, MapPin, Plus,
} from 'lucide-react';

type CalVMode = 'day' | 'week' | 'month';

interface CalItem {
  id: string;
  sourceId: string;           // noteId or eventId
  sourceType: 'note-reminder' | 'note-task' | 'event';
  title: string;
  subtitle?: string;
  color: string;
  datetime: Date;
  endDatetime?: Date;
  location?: string;
  allDay?: boolean;
  isCompleted?: boolean;
  eventColorClass?: string;   // for independent events
}

interface CalendarViewProps {
  notes: Note[];
  events: AppEvent[];
  tasks: AppTask[];
  onSelectNote: (note: Note) => void;
  onSelectEvent: (ev: AppEvent) => void;
  onSelectTask?: (task: AppTask) => void;
  onNewEvent: (date?: Date) => void;
}

/* ─── helpers ─── */
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const startOfWeek = (d: Date) => { const x = startOfDay(d); x.setDate(x.getDate() - x.getDay()); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const addMonths = (d: Date, n: number) => { const x = new Date(d); x.setMonth(x.getMonth()+n); return x; };

const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const AR_WD_SHORT = ['أحد','إثن','ثلا','أرب','خمي','جمع','سبت'];

const EVENT_CHIP: Record<string, string> = {
  amber:'bg-amber-500/25 text-amber-200 border-amber-500/30',
  emerald:'bg-emerald-500/25 text-emerald-200 border-emerald-500/30',
  sky:'bg-sky-500/25 text-sky-200 border-sky-500/30',
  rose:'bg-rose-500/25 text-rose-200 border-rose-500/30',
  purple:'bg-purple-500/25 text-purple-200 border-purple-500/30',
  slate:'bg-slate-700 text-slate-200 border-slate-600',
};

const typeIcon = (t: CalItem['sourceType']) => {
  if (t === 'event') return <CalendarClock size={11}/>;
  if (t === 'note-task') return <ListTodo size={11}/>;
  return <Bell size={11}/>;
};

const fmtTime = (d: Date) => d.toLocaleTimeString('ar-EG', { hour:'2-digit', minute:'2-digit', hour12:true });

/* ─── component ─── */
export const CalendarView: React.FC<CalendarViewProps> = ({
  notes, events, tasks, onSelectNote, onSelectEvent, onSelectTask, onNewEvent,
}) => {
  const [vMode, setVMode] = useState<CalVMode>('month');
  const [current, setCurrent] = useState(new Date());
  const [selected, setSelected] = useState(new Date());

  /* Build unified item list */
  const allItems = useMemo<CalItem[]>(() => {
    const items: CalItem[] = [];

    // Note reminders
    notes.forEach(n => {
      if (n.isTrash) return;
      if (n.reminder?.datetime) {
        items.push({
          id: `${n.id}-r`,
          sourceId: n.id,
          sourceType: n.reminder.type === 'event' ? 'event' : 'note-reminder',
          title: n.title,
          color: n.color,
          datetime: new Date(n.reminder.datetime),
          endDatetime: n.reminder.endDatetime ? new Date(n.reminder.endDatetime) : undefined,
          location: n.reminder.location,
        });
      }
      // Task reminders
      n.checklist?.forEach(t => {
        if (!t.reminderAt) return;
        items.push({
          id: `${n.id}-t-${t.id}`,
          sourceId: n.id,
          sourceType: 'note-task',
          title: t.text,
          subtitle: n.title,
          color: n.color,
          datetime: new Date(t.reminderAt),
          isCompleted: t.completed,
        });
      });
    });

    // Independent events
    events.forEach(ev => {
      items.push({
        id: `ev-${ev.id}`,
        sourceId: ev.id,
        sourceType: 'event',
        title: ev.title,
        subtitle: ev.location || undefined,
        color: ev.color,
        datetime: new Date(ev.startDatetime),
        endDatetime: new Date(ev.endDatetime),
        location: ev.location || undefined,
        allDay: ev.allDay,
        isCompleted: ev.isCompleted,
        eventColorClass: EVENT_CHIP[ev.color] ?? EVENT_CHIP.sky,
      });
    });

    // Independent tasks
    tasks.forEach(task => {
      const taskTime = task.dueDate || task.reminderAt;
      if (!taskTime) return;
      items.push({
        id: `task-${task.id}`,
        sourceId: task.id,
        sourceType: 'note-task',
        title: task.title,
        subtitle: task.description || undefined,
        color: task.color,
        datetime: new Date(taskTime),
        isCompleted: task.isCompleted,
        eventColorClass: EVENT_CHIP[task.color] ?? EVENT_CHIP.purple,
      });
    });

    return items.sort((a,b) => a.datetime.getTime() - b.datetime.getTime());
  }, [notes, events, tasks]);

  const itemsForDay = (d: Date) => allItems.filter(i => isSameDay(i.datetime, d));

  const handleItemClick = (item: CalItem) => {
    if (item.sourceType === 'event') {
      const ev = events.find(e => e.id === item.sourceId);
      if (ev) onSelectEvent(ev);
    } else if (item.id.startsWith('task-')) {
      const t = tasks.find(x => x.id === item.sourceId);
      if (t && onSelectTask) onSelectTask(t);
    } else {
      const note = notes.find(n => n.id === item.sourceId);
      if (note) onSelectNote(note);
    }
  };

  const navPrev = () => {
    if (vMode==='day') setCurrent(addDays(current,-1));
    else if (vMode==='week') setCurrent(addDays(current,-7));
    else setCurrent(addMonths(current,-1));
  };
  const navNext = () => {
    if (vMode==='day') setCurrent(addDays(current,1));
    else if (vMode==='week') setCurrent(addDays(current,7));
    else setCurrent(addMonths(current,1));
  };
  const today = () => { const d=new Date(); setCurrent(d); setSelected(d); };

  const headerText = () => {
    if (vMode==='day') return current.toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
    if (vMode==='week') {
      const s=startOfWeek(current), e=addDays(s,6);
      return `${s.getDate()} ${AR_MONTHS[s.getMonth()]} – ${e.getDate()} ${AR_MONTHS[e.getMonth()]} ${e.getFullYear()}`;
    }
    return `${AR_MONTHS[current.getMonth()]} ${current.getFullYear()}`;
  };

  /* ─── Render Day ─── */
  const renderDay = () => {
    const items = itemsForDay(current);
    return (
      <div className="space-y-2">
        <button
          onClick={() => onNewEvent(current)}
          className="w-full border border-dashed border-sky-500/30 hover:border-sky-500/60 rounded-xl p-3 text-xs text-sky-400/70 hover:text-sky-300 flex items-center justify-center gap-1.5 transition-colors"
        >
          <Plus size={14}/> إضافة حدث في هذا اليوم
        </button>

        {items.length === 0 ? (
          <div className="text-center py-10 text-slate-500">
            <CalendarIcon size={30} className="mx-auto mb-2 opacity-40"/>
            <p className="text-xs">لا توجد أحداث أو تذكيرات</p>
          </div>
        ) : (
          items.map(item => (
            <button key={item.id} onClick={() => handleItemClick(item)}
              className={`w-full text-right border rounded-2xl p-3 transition-all hover:scale-[1.01] active:scale-95 ${
                item.sourceType === 'event'
                  ? (item.eventColorClass ?? EVENT_CHIP.sky)
                  : item.sourceType === 'note-task'
                  ? 'bg-purple-500/10 border-purple-500/30 text-purple-200'
                  : `${COLOR_CLASSES[item.color]?.bg ?? ''} ${COLOR_CLASSES[item.color]?.border ?? ''}`
              } ${item.isCompleted ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold">
                  {typeIcon(item.sourceType)}
                  <span>{item.sourceType==='event'?'حدث':item.sourceType==='note-task'?'مهمة':'تذكير'}</span>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Clock size={10}/>
                  <span>{item.allDay ? 'يوم كامل' : fmtTime(item.datetime)}</span>
                </div>
              </div>
              <h4 className={`text-xs font-bold ${item.isCompleted ? 'line-through' : ''}`}>{item.title}</h4>
              {item.subtitle && <p className="text-[10px] text-slate-400 mt-0.5">↳ {item.subtitle}</p>}
              {item.endDatetime && !item.allDay && (
                <p className="text-[10px] text-slate-400 mt-0.5">حتى: {fmtTime(item.endDatetime)}</p>
              )}
              {item.location && (
                <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1"><MapPin size={9}/>{item.location}</p>
              )}
            </button>
          ))
        )}
      </div>
    );
  };

  /* ─── Render Week ─── */
  const renderWeek = () => {
    const ws = startOfWeek(current);
    const days = Array.from({length:7}, (_,i) => addDays(ws,i));
    const now = new Date();
    return (
      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const items = itemsForDay(day);
          const isToday = isSameDay(day, now);
          const isSel = isSameDay(day, selected);
          return (
            <button key={day.toISOString()} onClick={() => { setSelected(day); setCurrent(day); setVMode('day'); }}
              className={`flex flex-col rounded-xl border p-1 min-h-[110px] transition-all text-right ${
                isSel ? 'bg-amber-500/15 border-amber-500/50' :
                isToday ? 'bg-sky-500/10 border-sky-500/40' :
                'bg-slate-900/40 border-slate-800/60 hover:bg-slate-800/40'
              }`}
            >
              <div className="text-center mb-1">
                <div className={`text-[9px] ${isToday ? 'text-sky-400' : 'text-slate-500'}`}>{AR_WD_SHORT[day.getDay()]}</div>
                <div className={`text-sm font-bold ${isSel ? 'text-amber-400' : isToday ? 'text-sky-300' : 'text-white'}`}>{day.getDate()}</div>
              </div>
              <div className="space-y-0.5 flex-1 overflow-hidden">
                {items.slice(0,3).map(item => (
                  <div key={item.id} className={`text-[8px] px-1 py-0.5 rounded truncate flex items-center gap-0.5 border ${
                    item.sourceType==='event' ? (item.eventColorClass ?? EVENT_CHIP.sky) :
                    item.sourceType==='note-task' ? 'bg-purple-500/25 text-purple-200 border-purple-500/30' :
                    'bg-amber-500/25 text-amber-200 border-amber-500/30'
                  }`}>
                    {typeIcon(item.sourceType)}
                    <span className="truncate">{item.title}</span>
                  </div>
                ))}
                {items.length > 3 && <div className="text-[8px] text-slate-500 text-center">+{items.length-3}</div>}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  /* ─── Render Month ─── */
  const renderMonth = () => {
    const yr = current.getFullYear(), mo = current.getMonth();
    const firstDay = new Date(yr, mo, 1);
    const totalDays = new Date(yr, mo+1, 0).getDate();
    const now = new Date();

    const cells: Array<{day:number|null; date:Date|null}> = [];
    for (let i=0; i<firstDay.getDay(); i++) cells.push({day:null,date:null});
    for (let d=1; d<=totalDays; d++) cells.push({day:d, date:new Date(yr,mo,d)});
    while (cells.length%7!==0) cells.push({day:null,date:null});

    return (
      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-0.5">
          {AR_WD_SHORT.map(w => (
            <div key={w} className="text-center text-[9px] text-slate-500 font-bold py-1">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((cell, idx) => {
            if (!cell.date) return <div key={`e-${idx}`} className="aspect-square"/>;
            const items = itemsForDay(cell.date);
            const isToday = isSameDay(cell.date, now);
            const isSel = isSameDay(cell.date, selected);
            const types = new Set(items.map(i => i.sourceType));
            const hasEvent = types.has('event');
            const hasReminder = types.has('note-reminder');
            const hasTask = types.has('note-task');

            return (
              <button key={cell.date.toISOString()} onClick={() => { setSelected(cell.date!); setCurrent(cell.date!); setVMode('day'); }}
                className={`aspect-square rounded-lg border p-0.5 flex flex-col items-center transition-all relative ${
                  isSel ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold' :
                  isToday ? 'bg-sky-500/15 border-sky-500/50 text-sky-300' :
                  items.length ? 'bg-slate-800/80 border-slate-700/60 text-white hover:bg-slate-700/80' :
                  'bg-slate-900/40 border-slate-800/40 text-slate-400 hover:bg-slate-800/40'
                }`}
              >
                <span className="text-[10px] mt-0.5">{cell.day}</span>
                {items.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5">
                    {hasEvent && <span className={`w-1.5 h-1.5 rounded-full ${isSel ? 'bg-slate-950' : 'bg-sky-400'}`}/>}
                    {hasReminder && <span className={`w-1.5 h-1.5 rounded-full ${isSel ? 'bg-slate-950' : 'bg-amber-400'}`}/>}
                    {hasTask && <span className={`w-1.5 h-1.5 rounded-full ${isSel ? 'bg-slate-950' : 'bg-purple-400'}`}/>}
                  </div>
                )}
                {items.length > 0 && (
                  <span className={`absolute top-0 left-0 text-[7px] px-0.5 rounded-br rounded-tl leading-tight ${isSel ? 'bg-slate-950 text-amber-400' : 'bg-amber-500/20 text-amber-300'}`}>
                    {items.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected day preview */}
        {(() => {
          const items = itemsForDay(selected);
          return (
            <div className="mt-2 pt-3 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <CalendarIcon size={13} className="text-amber-400"/>
                  {selected.toLocaleDateString('ar-EG',{weekday:'long',day:'numeric',month:'long'})}
                </h4>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-500">{items.length} حدث</span>
                  <button onClick={() => onNewEvent(selected)}
                    className="text-[10px] bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 px-2 py-1 rounded-lg flex items-center gap-0.5 transition-colors"
                  >
                    <Plus size={11}/> جديد
                  </button>
                </div>
              </div>

              {items.length === 0 ? (
                <p className="text-[11px] text-slate-500 text-center py-2">لا توجد أحداث في هذا اليوم</p>
              ) : (
                items.map(item => (
                  <button key={item.id} onClick={() => handleItemClick(item)}
                    className={`w-full text-right border rounded-xl p-2 transition-all hover:scale-[1.01] ${
                      item.sourceType==='event' ? (item.eventColorClass ?? EVENT_CHIP.sky) :
                      item.sourceType==='note-task' ? 'bg-purple-500/10 border-purple-500/30 text-purple-200' :
                      `${COLOR_CLASSES[item.color]?.bg??''} ${COLOR_CLASSES[item.color]?.border??''}`
                    } ${item.isCompleted ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {typeIcon(item.sourceType)}
                        <span className={`text-[11px] font-bold truncate ${item.isCompleted ? 'line-through' : ''}`}>{item.title}</span>
                      </div>
                      <span className="text-[9px] text-slate-400 shrink-0">
                        {item.allDay ? 'يوم كامل' : fmtTime(item.datetime)}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  /* ─── Stats ─── */
  const now2 = new Date();
  const todayCnt = allItems.filter(i => isSameDay(i.datetime, now2)).length;
  const ws2 = startOfWeek(now2);
  const we2 = addDays(ws2, 6); we2.setHours(23,59,59,999);
  const weekCnt = allItems.filter(i => i.datetime >= startOfDay(now2) && i.datetime <= we2).length;
  const monthCnt = allItems.filter(i => i.datetime.getMonth()===current.getMonth() && i.datetime.getFullYear()===current.getFullYear()).length;

  return (
    <div className="p-4 space-y-3 pb-20 animate-fadeIn">
      {/* Top bar */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock size={18} className="text-sky-400"/>
            <h2 className="text-sm font-bold text-white">التقويم والأحداث</h2>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {[
            {label:'اليوم', count:todayCnt, color:'text-amber-400 border-amber-500/20'},
            {label:'الأسبوع', count:weekCnt, color:'text-sky-400 border-sky-500/20'},
            {label:'الشهر', count:monthCnt, color:'text-purple-400 border-purple-500/20'},
          ].map(s => (
            <div key={s.label} className={`bg-slate-900/60 rounded-xl p-2 text-center border ${s.color}`}>
              <div className="text-[9px] text-slate-400 mb-0.5">{s.label}</div>
              <div className={`text-sm font-bold ${s.color.split(' ')[0]}`}>{s.count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* View switcher */}
      <div className="bg-slate-800/80 p-1 rounded-xl flex gap-1 border border-slate-700">
        {[
          {id:'day', label:'يومي', Icon:CalendarIcon},
          {id:'week', label:'أسبوعي', Icon:CalendarRange},
          {id:'month', label:'شهري', Icon:CalendarDays},
        ].map(item => {
          const Icon = item.Icon;
          const active = vMode === item.id;
          return (
            <button key={item.id} onClick={() => setVMode(item.id as CalVMode)}
              className={`flex-1 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all ${
                active ? 'bg-amber-500 text-slate-950 font-bold shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon size={13}/><span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between bg-slate-900/60 rounded-xl border border-slate-800 p-2">
        <button onClick={navPrev}
          className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-amber-400 hover:bg-slate-700 transition-colors"
        >
          <ChevronRight size={16}/>
        </button>
        <div className="text-center">
          <span className="text-xs font-bold text-white">{headerText()}</span>
          <button onClick={today} className="block text-[10px] text-amber-400 hover:text-amber-300 mt-0.5">اليوم</button>
        </div>
        <button onClick={navNext}
          className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-amber-400 hover:bg-slate-700 transition-colors"
        >
          <ChevronLeft size={16}/>
        </button>
      </div>

      {/* Body */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-3">
        {vMode === 'day' && renderDay()}
        {vMode === 'week' && renderWeek()}
        {vMode === 'month' && renderMonth()}
      </div>

      {/* Legend */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-2.5 flex items-center justify-around text-[10px]">
        <div className="flex items-center gap-1 text-sky-300"><CalendarClock size={11}/><span>أحداث</span></div>
        <div className="flex items-center gap-1 text-amber-300"><Bell size={11}/><span>تذكيرات</span></div>
        <div className="flex items-center gap-1 text-purple-300"><ListTodo size={11}/><span>مهام</span></div>
      </div>
    </div>
  );
};
