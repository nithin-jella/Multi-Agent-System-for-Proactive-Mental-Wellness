// src/icons/index.ts
// Centralized icon exports to optimize bundle size and reduce import statements

// React Icons - Feather Icons (Fi)
export {
  FiLock, FiMail, FiAlertCircle, FiLogIn, FiEye, FiEyeOff,
  FiInfo, FiShield, FiUsers, FiBarChart, FiSettings,
  FiActivity, FiBookOpen, FiPhone, FiHeart, FiUser,
  FiCalendar, FiMapPin, FiBook, FiSend, FiArrowLeft,
  FiCheckCircle, FiLoader, FiChevronDown, FiPlusSquare,
  FiMessageSquare, FiSave, FiX, FiArrowRight, FiXCircle,
  FiClock, FiChevronLeft, FiChevronRight, FiCheck,
  FiSearch, FiBell, FiMenu, FiLogOut, FiPieChart,
  FiHelpCircle, FiLink, FiCopy, FiRefreshCw, FiAward,
  FiGrid, FiMessageCircle, FiBarChart2, FiFileText,
  FiEdit3, FiPlus, FiTrendingUp, FiExternalLink,
  FiGlobe, FiAlertTriangle, FiUserPlus, FiFilter,
  FiDownload, FiMoreHorizontal, FiEdit, FiPlayCircle,
  FiRefreshCcw, FiPlay, FiPause, FiLayers, FiSmile,
  FiZap, FiCompass, FiTarget, FiGift, FiDollarSign
} from 'react-icons/fi';

// React Icons - Font Awesome (Fa)
export {
  FaComments, FaHeartbeat, FaLock, FaArrowRight,
  FaGoogle, FaFacebookF, FaTwitter, FaInstagram,
  FaLinkedinIn, FaYoutube, FaArrowLeft, FaRobot,
  FaHeart, FaSearch, FaStar, FaMagic, FaSpinner,
  FaCheckCircle, FaExclamationCircle, FaExclamationTriangle,
  FaShoppingCart, FaTicketAlt, FaGraduationCap, FaHandHoldingHeart,
  FaCoins
} from 'react-icons/fa';

// React Icons - Heroicons (Hi)
export {
  HiChevronRight, HiMenu, HiChevronDown, HiX
} from 'react-icons/hi';

// React Icons - Bootstrap (Bs)
export {
  BsChatDots, BsCalendar, BsQuestionCircle
} from 'react-icons/bs';

// React Icons - Bootstrap Icons (Bi)
export {
  BiSmile, BiSad
} from 'react-icons/bi';

// Type exports for better TypeScript support
export type IconType = React.ComponentType<React.SVGProps<SVGSVGElement>>;
export type IconProps = React.SVGProps<SVGSVGElement>;
