import { Card } from "@/components/ui/card"
import {
    Clock,
    Truck,
    ShoppingBag,
    AlertTriangle,
    RotateCcw,
    PackageCheck,
    PackageX,
    Ban,
    CheckSquare,
    ClipboardList
} from "lucide-react"
import { memo } from "react"

interface OrderStatusCardProps {
    title: string
    count: number
    icon: 'pending' | 'process' | 'shipping' | 'cancel' | 'total' | 'failed' | 'completed' | 'confirm' | 'return' | 'fake'
    onClick: () => void
    isActive: boolean
}

const iconMap = {
    pending: Clock,
    process: PackageCheck,
    shipping: Truck,
    cancel: Ban,
    total: ShoppingBag,
    failed: PackageX,
    completed: CheckSquare,
    confirm: ClipboardList,
    return: RotateCcw,
    fake: AlertTriangle
} as const

const activeColorMap = {
    pending: 'bg-amber-500 text-white',
    process: 'bg-blue-600 text-white',
    shipping: 'bg-teal-600 text-white',
    cancel: 'bg-rose-600 text-white',
    total: 'bg-indigo-600 text-white',
    failed: 'bg-orange-600 text-white',
    completed: 'bg-emerald-600 text-white',
    confirm: 'bg-sky-600 text-white',
    return: 'bg-violet-600 text-white',
    fake: 'bg-fuchsia-600 text-white'
} as const

const iconColorMap = {
    pending: 'text-amber-500',
    process: 'text-blue-600',
    shipping: 'text-teal-600',
    cancel: 'text-rose-600',
    total: 'text-indigo-600',
    failed: 'text-orange-600',
    completed: 'text-emerald-600',
    confirm: 'text-sky-600',
    return: 'text-violet-600',
    fake: 'text-fuchsia-600'
} as const

function OrderStatusCardComponent({ title, count, icon, onClick, isActive }: OrderStatusCardProps) {
    const Icon = iconMap[icon]
    const activeColor = activeColorMap[icon]
    const iconColor = iconColorMap[icon]

    return (
        <Card
            className={`transition-all duration-300 cursor-pointer ${isActive
                    ? `${activeColor} shadow-lg scale-[1.02]`
                    : 'hover:bg-muted/50 hover:scale-[1.02]'
                }`}
            onClick={onClick}
        >
            <div className="p-2.5">
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <p className={`text-xs font-medium ${isActive ? 'text-white/80' : 'text-muted-foreground'} line-clamp-1`}>
                            {title}
                        </p>
                        <p className={`text-lg sm:text-xl font-bold tracking-tight ${isActive ? 'text-white' : ''}`}>
                            {count}
                        </p>
                    </div>
                    <div className={`p-1.5 rounded-lg ${isActive
                            ? 'bg-white/20'
                            : `bg-background ${iconColor}`
                        }`}>
                        <Icon className="w-5 h-5" />
                    </div>
                </div>
            </div>
        </Card>
    )
}

export const OrderStatusCard = memo(OrderStatusCardComponent)
