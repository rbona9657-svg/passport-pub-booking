"use client"

import * as React from "react"
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
  startOfDay,
} from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export interface CalendarProps {
  className?: string
  selected?: Date
  onSelect?: (date: Date | undefined) => void
  disabled?: (date: Date) => boolean
  month?: Date
  onMonthChange?: (month: Date) => void
  fromDate?: Date
  toDate?: Date
}

function Calendar({
  className,
  selected,
  onSelect,
  disabled,
  month: controlledMonth,
  onMonthChange,
  fromDate,
  toDate,
}: CalendarProps) {
  const [internalMonth, setInternalMonth] = React.useState(
    selected || new Date()
  )
  const currentMonth = controlledMonth || internalMonth

  const handleMonthChange = (newMonth: Date) => {
    if (onMonthChange) {
      onMonthChange(newMonth)
    } else {
      setInternalMonth(newMonth)
    }
  }

  const goToPreviousMonth = () => {
    handleMonthChange(subMonths(currentMonth, 1))
  }

  const goToNextMonth = () => {
    handleMonthChange(addMonths(currentMonth, 1))
  }

  const isDateDisabled = (date: Date) => {
    if (disabled && disabled(date)) return true
    if (fromDate && isBefore(date, startOfDay(fromDate))) return true
    if (toDate && isBefore(startOfDay(toDate), startOfDay(date))) return true
    return false
  }

  const handleDateClick = (date: Date) => {
    if (isDateDisabled(date)) return
    if (onSelect) {
      if (selected && isSameDay(date, selected)) {
        onSelect(undefined)
      } else {
        onSelect(date)
      }
    }
  }

  const renderDays = () => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

    const days: React.ReactNode[] = []
    let day = calendarStart

    while (day <= calendarEnd) {
      const currentDay = day
      const isSelected = selected ? isSameDay(currentDay, selected) : false
      const isCurrentMonth = isSameMonth(currentDay, currentMonth)
      const isDisabled = isDateDisabled(currentDay)
      const isTodayDate = isToday(currentDay)

      days.push(
        <button
          key={currentDay.toISOString()}
          type="button"
          onClick={() => handleDateClick(currentDay)}
          disabled={isDisabled}
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "h-8 w-8 p-0 font-normal",
            !isCurrentMonth && "text-muted-foreground opacity-50",
            isSelected &&
              "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
            isTodayDate && !isSelected && "bg-accent text-accent-foreground",
            isDisabled && "pointer-events-none opacity-50"
          )}
        >
          {format(currentDay, "d")}
        </button>
      )

      day = addDays(day, 1)
    }

    return days
  }

  const weekDays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]

  return (
    <div className={cn("p-3", className)}>
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={goToPreviousMonth}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-sm font-medium">
          {format(currentMonth, "MMMM yyyy")}
        </div>
        <button
          type="button"
          onClick={goToNextMonth}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => (
          <div
            key={day}
            className="flex h-8 w-8 items-center justify-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
        {renderDays()}
      </div>
    </div>
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
