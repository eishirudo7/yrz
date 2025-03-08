"use client"

import * as React from "react"
import { addDays, format, subDays } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"
import { id } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function DatePickerWithRange({
  className,
  onDateChange,
}: React.HTMLAttributes<HTMLDivElement> & {
  onDateChange?: (from: string | undefined, to: string | undefined) => void
}) {
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  })
  const [tempDate, setTempDate] = React.useState<DateRange | undefined>(date)
  const [isOpen, setIsOpen] = React.useState(false)

  const handleConfirm = () => {
    setDate(tempDate)
    setIsOpen(false)
    if (tempDate?.from && tempDate?.to && onDateChange) {
      onDateChange(
        format(tempDate.from, "dd-MM-yyyy"),
        format(tempDate.to, "dd-MM-yyyy")
      )
    }
  }

  const presetRanges = [
    { label: 'Hari ini', getDates: () => ({ from: new Date(), to: new Date() }) },
    { label: 'Kemarin', getDates: () => {
      const yesterday = subDays(new Date(), 1);
      return { from: yesterday, to: yesterday };
    }},
    { label: '7 hari', getDates: () => ({ from: new Date(), to: addDays(new Date(), 6) }) },
    { label: '30 hari', getDates: () => ({ from: new Date(), to: addDays(new Date(), 29) }) },
    
  ]

  return (
    <div className={cn("grid gap-2", className, "sm:grid-cols-1 md:grid-cols-2")}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full md:w-[300px] justify-center text-left font-normal",
              !date && "text-muted-foreground",
              "hover:bg-primary hover:text-primary-foreground transition-colors duration-200"
            )}
          >
            <CalendarIcon className="mr-2 h-5 w-5" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "dd-MM-yyyy")} -{" "}
                  {format(date.to, "dd-MM-yyyy")}
                </>
              ) : (
                format(date.from, "dd-MM-yyyy")
              )
            ) : (
              <span>Pilih tanggal</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full md:w-auto p-0" align="start">
          <div className="flex flex-wrap p-2 bg-muted/50">
            {presetRanges.map((range) => (
              <Button
                key={range.label}
                variant="outline"
                size="sm"
                className="mr-2 mb-2"
                onClick={() => setTempDate(range.getDates())}
              >
                {range.label}
              </Button>
            ))}
          </div>
          <Calendar
            mode="range"
            defaultMonth={tempDate?.from}
            selected={tempDate}
            onSelect={setTempDate}
            numberOfMonths={1}
            className="text-center flex justify-center"
            locale={id}
          />
          <div className="flex justify-end p-3">
            <Button onClick={handleConfirm}>Konfirmasi</Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
