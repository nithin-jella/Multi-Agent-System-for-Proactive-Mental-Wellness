import React from 'react';
import { 
  FiPhone, 
  FiMapPin, 
  FiGlobe, 
  FiMessageSquare, 
  FiMail, 
  FiUsers, 
  FiClock, 
  FiInfo, 
  FiExternalLink 
} from '@/icons';
import Image from 'next/image';

export interface ResourceCardProps {
    name: string;
    description: string;
    targetAudience?: string;
    servicesOffered?: string[];
    phone?: string;
    whatsapp?: string;
    email?: string;
    website?: string;
    address?: string;
    operatingHours?: string;
    notes?: string;
    logoUrl?: string;
    category?: 'UGM' | 'National' | 'International'; // Optional category for future filtering
}

const ResourceCard: React.FC<ResourceCardProps> = ({
    name, description, targetAudience, servicesOffered, phone, whatsapp, email, website, address, operatingHours, notes, logoUrl
}) => {
    const cleanPhoneNumberForTelLink = (num?: string) => num?.replace(/[^\d+]/g, '');
    const cleanWhatsAppNumber = (num?: string) => num?.replace(/\D/g, '');

    return (
        <div className="p-4 sm:p-5 bg-linear-to-br from-white/5 via-white/10 to-white/5 rounded-xl border border-white/10 shadow-lg hover:border-white/20 transition-all duration-300 ease-in-out flex flex-col h-full">
            {logoUrl && (
                <div className="mb-3">
                    <Image
                        src={logoUrl}
                        alt={`${name} logo`}
                        className="h-12 w-auto rounded object-contain"
                        width={48}
                        height={48}
                        style={{ width: 'auto', height: '3rem' }}
                        priority
                    />
                </div>
            )}
            <h3 className="text-lg font-semibold text-[#FFCA40] mb-1.5">{name}</h3>
            <p className="text-sm text-gray-300 mb-3 grow">{description}</p>

            {targetAudience && (
                <div className="flex items-center text-xs text-gray-400 mb-2">
                    <FiUsers className="mr-2 shrink-0 text-ugm-blue-light" /> For: {targetAudience}
                </div>
            )}

            {servicesOffered && servicesOffered.length > 0 && (
                <div className="mb-3">
                    <p className="text-xs font-medium text-gray-400 mb-1.5">Services Offered:</p>
                    <div className="flex flex-wrap gap-1.5">
                        {servicesOffered.map(service => (
                            <span key={service} className="px-2.5 py-1 text-[0.7rem] bg-ugm-gold text-ugm-blue-light rounded-full border border-ugm-blue-light/30 shadow-sm">
                                {service}
                            </span>
                        ))}
                    </div>
                </div>
            )}
            
            <div className="mt-auto space-y-1.5 pt-3 border-t border-white/10">
                {operatingHours && (
                    <div className="flex items-start text-sm text-gray-300">
                        <FiClock className="mr-2.5 mt-0.5 shrink-0 text-gray-400" size={15}/>
                        <span>{operatingHours}</span>
                    </div>
                )}
                {address && (
                    <div className="flex items-start text-sm text-gray-300">
                        <FiMapPin className="mr-2.5 mt-0.5 shrink-0 text-gray-400" size={15}/>
                        <span>{address}</span>
                    </div>
                )}
                {phone && (
                    <div className="flex items-center text-sm text-gray-300">
                        <FiPhone className="mr-2.5 shrink-0 text-gray-400" size={15}/>
                        <a href={`tel:${cleanPhoneNumberForTelLink(phone)}`} className="hover:text-[#FFCA40] transition-colors">{phone}</a>
                    </div>
                )}
                {whatsapp && (
                     <div className="flex items-center text-sm text-gray-300">
                        <FiMessageSquare className="mr-2.5 shrink-0 text-gray-400" size={15}/>
                        <a href={`https://wa.me/${cleanWhatsAppNumber(whatsapp)}`} target="_blank" rel="noopener noreferrer" className="hover:text-[#FFCA40] transition-colors">
                            WhatsApp: {whatsapp} <FiExternalLink className="inline ml-1" size={12}/>
                        </a>
                    </div>
                )}
                {email && (
                    <div className="flex items-center text-sm text-gray-300">
                        <FiMail className="mr-2.5 shrink-0 text-gray-400" size={15}/>
                        <a href={`mailto:${email}`} className="hover:text-[#FFCA40] transition-colors">{email}</a>
                    </div>
                )}
                {website && (
                    <div className="flex items-center text-sm text-gray-300">
                        <FiGlobe className="mr-2.5 shrink-0 text-gray-400" size={15}/>
                        <a href={website.startsWith('http') ? website : `https://${website}`} target="_blank" rel="noopener noreferrer" className="hover:text-[#FFCA40] transition-colors truncate">
                            {website} <FiExternalLink className="inline ml-1" size={12}/>
                        </a>
                    </div>
                )}
                {notes && (
                    <div className="flex items-start text-xs text-gray-400 mt-2 pt-2 border-t border-white/10">
                         <FiInfo className="mr-2 mt-0.5 shrink-0" />
                        <span>{notes}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResourceCard;