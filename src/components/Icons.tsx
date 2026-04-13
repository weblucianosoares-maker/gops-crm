import { 
  LayoutDashboard, 
  Users, 
  Filter, 
  FileText, 
  Building2, 
  HelpCircle, 
  LogOut,
  Bell,
  Settings,
  TrendingUp,
  ExternalLink,
  Cake,
  MoreVertical,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  UploadCloud,
  CheckCircle2,
  Phone,
  Mail,
  X,
  Check,
  Info,
  Menu,
  ChevronDown,
  MapPin,
  Briefcase,
  Heart,
  History,
  CreditCard,
  Target,
  MessageSquare,
  Calendar,
  Clock,
  Trash2,
  Edit2,
  AlertCircle,
  UserPlus,
  Shield,
  Camera,
  Lock,
  Eye,
  EyeOff,
  Image,
  Paperclip,
  FileSearch,
  Download,
  Trophy,
  Gem,
  Loader2,
  Mic,
  Play,
  File,
  Save,
  Rocket,
  ShieldCheck,
  Hospital
} from "lucide-react";

export const Icons = {
  Dashboard: LayoutDashboard,
  Leads: Users,
  Funnel: Filter,
  Contracts: FileText,
  FileText: FileText,
  Carriers: Building2,
  Building2: Building2,
  Filter: Filter,
  Support: HelpCircle,
  Logout: LogOut,
  Notifications: Bell,
  Bell: Bell,
  Settings: Settings,
  TrendingUp: TrendingUp,
  Cake: Cake,
  More: MoreVertical,
  Search: Search,
  Plus: Plus,
  ChevronLeft: ChevronLeft,
  ChevronRight: ChevronRight,
  ChevronUp: ChevronUp,
  Upload: UploadCloud,
  CheckCircle: CheckCircle2,
  Phone: Phone,
  Mail: Mail,
  X: X,
  Check: Check,
  Info: Info,
  Menu: Menu,
  ChevronDown: ChevronDown,
  MapPin: MapPin,
  Briefcase: Briefcase,
  Heart: Heart,
  History: History,
  CreditCard: CreditCard,
  Target: Target,
  MessageSquare: MessageSquare,
  Users: Users,
  Calendar: Calendar,
  Clock: Clock,
  Trash: Trash2,
  Edit: Edit2,
  AlertCircle: AlertCircle,
  UserPlus: UserPlus,
  Shield: Shield,
  Camera: Camera,
  Lock: Lock,
  Eye: Eye,
  EyeOff: EyeOff,
  Image: Image,
  Paperclip: Paperclip,
  FileSearch: FileSearch,
  Download: Download,
  Trophy: Trophy,
  Gem: Gem,
  Loader2: Loader2,
  Mic: Mic,
  Play: Play,
  File: File,
  Save: Save,
  ExternalLink: ExternalLink,
  Rocket: Rocket,
  ShieldCheck: ShieldCheck,
  Google: (props: any) => (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
      />
    </svg>
  ),
  Hospital: Hospital,
  WhatsApp: (props: any) => (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42 1.56 1.56 2.41 3.63 2.41 5.82 0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.39-4.19-1.14l-.3-.17-3.12.82.83-3.04-.19-.3a8.204 8.204 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24zm-3.61 4.63c-.2.01-.4.04-.59.11-.2.08-.38.22-.53.41-.33.39-.56.88-.66 1.39-.1.52.02 1.05.28 1.53.33.61.81 1.15 1.37 1.58 1.48 1.14 3.08 2.08 4.79 2.8.31.13.63.24.96.33.39.1.8.11 1.2.03.44-.08.84-.28 1.16-.58.33-.31.57-.71.68-1.15.1-.42-.01-.86-.28-1.2-.1-.13-.23-.25-.37-.36-.31-.22-.65-.41-.99-.58-.33-.16-.69-.21-1.04-.15-.31.05-.59.2-.8.43-.16.16-.3.35-.41.56-.25.5-.66.9-1.18 1.12-.13.05-.27.08-.41.08-.14 0-.28-.03-.41-.08-1.55-.65-3.03-1.45-4.41-2.4-.33-.24-.62-.51-.88-.82-.28-.33-.42-.76-.39-1.19.03-.31.14-.61.32-.86.13-.19.29-.36.47-.5.18-.13.38-.24.6-.33.27-.11.45-.31.52-.6.06-.29.02-.59-.12-.86-.16-.31-.38-.6-.65-.85-.2-.2-.42-.37-.67-.5-.25-.13-.53-.2-.82-.2z"
      />
    </svg>
  )
};
