import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { 
  getSettings, 
  saveSettings, 
  changePassword as apiChangePassword, 
  updateLogo 
} from "../api/settings.api";
import { useNotification } from "@/shared/hooks/useNotification";
import { ActivityLogsTable } from "../components/ActivityLogsTable";
import { Skeleton } from "@/shared/components/common/Skeleton";
import { FormModal } from "@/shared/components/common/FormModal";

export function SettingsPage() {
  const { tab: urlTab } = useParams();
  const navigate = useNavigate();
  const activeTab = urlTab || "general";
  
  const notify = useNotification();
  const queryClient = useQueryClient();
  const [localSettings, setLocalSettings] = useState(null);
  const logoInputRef = useRef(null);

  // Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: ""
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const data = await getSettings();
      setLocalSettings(data);
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      notify.success("System configurations updated");
    },
    onError: (error) => notify.error(error.response?.data?.message || "Failed to persist settings")
  });

  const passwordMutation = useMutation({
    mutationFn: apiChangePassword,
    onSuccess: () => {
      notify.success("Administrative credentials updated");
      setShowPasswordModal(false);
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
    },
    onError: (error) => notify.error(error.response?.data?.message || "Password update failed")
  });

  const logoMutation = useMutation({
    mutationFn: updateLogo,
    onSuccess: (res) => {
      handleInputChange('general', 'system_logo', res.data.url);
      notify.success("System logo updated and persisted");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error) => notify.error(error.response?.data?.message || "Logo upload failed")
  });

  const tabs = [
    { id: 'general',       name: 'General',       icon: 'fa-cog'       },
    { id: 'notifications', name: 'Notifications', icon: 'fa-bell'      },
    { id: 'security',      name: 'Security',      icon: 'fa-shield-alt'},
    { id: 'system',        name: 'System',        icon: 'fa-server'    },
  ];

  const handleInputChange = (category, key, value) => {
    setLocalSettings(prev => ({
      ...prev,
      [category]: {
        ...prev?.[category],
        [key]: value
      }
    }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) return notify.error("File size must be less than 5MB");
      const formData = new FormData();
      formData.append("logo", file);
      logoMutation.mutate(formData);
    }
  };

  const handleSave = () => {
    const payload = [];
    Object.keys(localSettings).forEach(category => {
      Object.keys(localSettings[category]).forEach(key => {
        payload.push({
          key,
          value: String(localSettings[category][key]),
          category
        });
      });
    });
    saveMutation.mutate(payload);
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      return notify.error("Passwords do not match");
    }
    passwordMutation.mutate({
      current_password: passwordForm.current_password,
      new_password: passwordForm.new_password
    });
  };

  if (isLoading || !localSettings) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[68px] w-full" />
        <div className="flex gap-4">
          <Skeleton className="h-[400px] w-[200px]" />
          <Skeleton className="h-[400px] flex-1" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* HEADER SECTION */}
      <section className="erp-page-section">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <i className="fas fa-tools text-[18px] text-[#90caf9]" />
            <div>
              <div className="erp-page-title">System Settings</div>
              <div className="erp-page-description">Configure cross-module parameters and administrative infrastructure</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeTab !== 'activity-logs' && (
              <>
                <button 
                  type="button" 
                  className="erp-header-secondary-button"
                  onClick={() => setLocalSettings(settings)}
                  disabled={saveMutation.isPending}
                >
                  <i className="fas fa-undo mr-1.5" />
                  Discard Changes
                </button>
                <button 
                  type="button" 
                  className="erp-header-primary-button" 
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                >
                  <i className={`${saveMutation.isPending ? 'fas fa-spinner animate-spin' : 'fas fa-save'} mr-2`} />
                  Update Configuration
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* MAIN CONTENT AREA */}
      <div className="erp-page-main-card flex overflow-hidden min-h-[500px]">
        {/* SIDEBAR NAVIGATION - NOW INTEGRATED */}
        <aside className="w-[220px] shrink-0 bg-[#f8fbfd] border-r border-[#d7e3ec] py-4 space-y-0.5">
          <div className="px-4 mb-4 text-[10px] font-bold text-[#90a4ae] uppercase tracking-widest">
            Configuration
          </div>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => navigate(`/admin/settings/${tab.id}`)}
              className={`w-full flex items-center gap-3 px-6 py-2.5 text-left transition-all text-[12px] font-bold ${
                activeTab === tab.id
                  ? 'bg-white text-accent-500 border-r-4 border-r-accent-500 shadow-sm'
                  : 'text-[#546e7a] hover:bg-[#eef5fa]'
              }`}
            >
              <i className={`fas ${tab.icon} w-4 text-center ${activeTab === tab.id ? 'text-accent-500' : 'text-[#90a4ae]'}`} />
              {tab.name}
            </button>
          ))}
        </aside>

        {/* TABS CONTENT */}
        <main className="flex-1 bg-white">
          <div className="h-full">
            {activeTab === 'general' && (
              <div className="p-6 space-y-8 animate-in fade-in duration-300">
                <div className="grid grid-cols-3 gap-8">
                   <div className="col-span-1 space-y-4">
                      <div className="erp-label !mb-4">System Branding</div>
                      <div className="relative group mx-auto w-40 h-40 bg-white border-2 border-dashed border-[#cfd8dc] rounded-sm flex items-center justify-center overflow-hidden transition hover:border-[#0070b8]">
                        {localSettings.general?.system_logo ? (
                           <img src={localSettings.general.system_logo} className="w-full h-full object-contain p-2" alt="Logo" />
                        ) : (
                           <div className="text-center">
                              <i className="fas fa-cloud-upload-alt text-[32px] text-[#cfd8dc] mb-2" />
                              <div className="text-[10px] text-[#90a4ae] font-bold uppercase">Upload Logo</div>
                           </div>
                        )}
                        <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoChange} />
                        <button 
                            onClick={() => logoInputRef.current.click()}
                            className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition flex items-center justify-center flex-col gap-1"
                        >
                           <i className="fas fa-camera text-[18px]" />
                           <span className="text-[10px] font-bold uppercase">Change Asset</span>
                        </button>
                      </div>
                      <p className="text-[10px] text-[#90a4ae] text-center leading-relaxed">
                        PNG or JPG supported. High resolution square assets recommended.
                      </p>
                      {localSettings.general?.system_logo && (
                        <div className="text-center">
                          <button onClick={() => handleInputChange('general', 'system_logo', '')} className="text-[10px] text-[#c62828] font-bold hover:underline">Remove Branding</button>
                        </div>
                      )}
                   </div>

                   <div className="col-span-2 space-y-6">
                      <div className="erp-label !mb-4">Business Information</div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                           <label className="erp-label">Legal Entity Name</label>
                           <input className="erp-input" value={localSettings.general?.company_name || ""} onChange={(e) => handleInputChange('general', 'company_name', e.target.value)} />
                        </div>
                        <div>
                           <label className="erp-label">System Short Name</label>
                           <input className="erp-input" value={localSettings.general?.company_short_name || ""} onChange={(e) => handleInputChange('general', 'company_short_name', e.target.value)} />
                        </div>
                        <div>
                           <label className="erp-label">Business TIN</label>
                           <input className="erp-input" value={localSettings.general?.business_tin || ""} onChange={(e) => handleInputChange('general', 'business_tin', e.target.value)} />
                        </div>
                        <div>
                           <label className="erp-label">Support Email</label>
                           <input className="erp-input" value={localSettings.general?.company_email || ""} onChange={(e) => handleInputChange('general', 'company_email', e.target.value)} />
                        </div>
                        <div>
                           <label className="erp-label">Contact Hotline</label>
                           <input className="erp-input" value={localSettings.general?.company_phone || ""} onChange={(e) => handleInputChange('general', 'company_phone', e.target.value)} />
                        </div>
                        <div className="col-span-2">
                           <label className="erp-label">Primary Business Address</label>
                           <textarea className="erp-textarea" value={localSettings.general?.company_address || ""} onChange={(e) => handleInputChange('general', 'company_address', e.target.value)} />
                        </div>
                      </div>
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="p-6 space-y-6 animate-in fade-in duration-300">
                <div className="erp-label !mb-4">Operational Alert Delivery</div>
                <div className="divide-y divide-[#eceff1] border border-[#eceff1] rounded-sm">
                  {[
                    { id: 'order_notifications_enabled', label: 'Sales & Inventory Releases', desc: 'Notify staff on new sales orders and stock departures.', icon: 'fa-shopping-cart' },
                    { id: 'stock_alerts_enabled', label: 'Safety Stock Warnings', desc: 'Critical alerts when products reach reorder points.', icon: 'fa-boxes' },
                    { id: 'payment_alerts_enabled', label: 'Accounts Receivable Tracking', desc: 'Alerts for payment arrivals and collection targets.', icon: 'fa-money-check-alt' },
                    { id: 'system_updates_enabled', label: 'Broadcast Maintenance', desc: 'Display global maintenance banners to all logged-in users.', icon: 'fa-bullhorn' }
                  ].map(item => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-white hover:bg-[#fbfdff] transition-colors">
                      <div className="flex items-center gap-4">
                         <div className={`w-9 h-9 rounded-sm flex items-center justify-center ${localSettings.notifications?.[item.id] === "1" ? "bg-[#e8f1f8] text-accent-500" : "bg-[#f5f7f9] text-[#90a4ae]"}`}>
                            <i className={`fas ${item.icon} text-[13px]`} />
                         </div>
                         <div>
                            <div className="text-[12px] font-bold text-[#1a3557]">{item.label}</div>
                            <div className="text-[10px] text-[#90a4ae]">{item.desc}</div>
                         </div>
                      </div>
                      <button 
                        onClick={() => handleInputChange('notifications', item.id, localSettings.notifications?.[item.id] === "1" ? "0" : "1")}
                        className={`group relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${localSettings.notifications?.[item.id] === "1" ? 'bg-accent-500' : 'bg-[#cfd8dc]'}`}
                      >
                        <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${localSettings.notifications?.[item.id] === "1" ? 'translate-x-[22px]' : 'translate-x-[4px]'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'security' && (
               <div className="p-6 space-y-8 animate-in fade-in duration-300">
                  <div className="grid grid-cols-2 gap-8">
                     <div className="space-y-6">
                        <div className="erp-label !mb-4">Session & Access Policy</div>
                        <div className="space-y-4">
                           <div>
                             <label className="erp-label">Interactive Session Timeout</label>
                             <select className="erp-select" value={localSettings.security?.session_timeout || "60"} onChange={(e) => handleInputChange('security', 'session_timeout', e.target.value)}>
                               <option value="15">15 Minutes of Inactivity</option>
                               <option value="60">1 Hour Persistence</option>
                               <option value="480">8 Hours (End of Shift)</option>
                             </select>
                           </div>
                           <div>
                             <label className="erp-label">Automatic Account Lockout</label>
                             <select className="erp-select" value={localSettings.security?.login_attempts || "5"} onChange={(e) => handleInputChange('security', 'login_attempts', e.target.value)}>
                               <option value="3">3 Failed Attempts</option>
                               <option value="5">5 Failed Attempts</option>
                               <option value="10">10 Failed Attempts</option>
                             </select>
                           </div>
                        </div>

                        <div className="p-4 bg-[#f8fbfd] border border-[#d1e3f2] rounded-sm flex items-center justify-between">
                           <div>
                              <div className="text-[12px] font-bold text-[#1a3557]">Multifactor Authentication (MFA)</div>
                              <div className="text-[10px] text-[#546e7a]">Require secondary TOTP codes for administrative accounts.</div>
                           </div>
                           <button 
                             onClick={() => handleInputChange('security', 'two_factor_auth', localSettings.security?.two_factor_auth === "1" ? "0" : "1")}
                             className={`group relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${localSettings.security?.two_factor_auth === "1" ? 'bg-accent-500' : 'bg-[#cfd8dc]'}`}
                           >
                             <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${localSettings.security?.two_factor_auth === "1" ? 'translate-x-[22px]' : 'translate-x-[4px]'}`} />
                           </button>
                        </div>
                     </div>
                     
                     <div className="space-y-6">
                        <div className="erp-label !mb-4">Privacy Credentials</div>
                        <div className="p-6 bg-white border border-[#cfd8dc] rounded-sm text-center shadow-sm">
                           <div className="w-12 h-12 bg-[#e8f1f8] rounded-full flex items-center justify-center mx-auto mb-4">
                              <i className="fas fa-key text-[20px] text-accent-500" />
                           </div>
                           <h4 className="text-[13px] font-bold text-[#1a3557] mb-2">Administrative Profile</h4>
                           <p className="text-[11px] text-[#90a4ae] mb-6 leading-relaxed">Update your primary security credentials to maintain system integrity.</p>
                           <button onClick={() => setShowPasswordModal(true)} className="erp-button-primary w-full h-9">Update Access Secret</button>
                        </div>
                     </div>
                  </div>
               </div>
            )}

            {activeTab === 'system' && (
              <div className="p-6 space-y-8 animate-in fade-in duration-300">
                 <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-6">
                       <div className="erp-label !mb-4">Data Retention & Maintenance</div>
                       <div className="space-y-1.5">
                         <label className="erp-label">Transaction Purge Cycle</label>
                         <select className="erp-select" value={localSettings.system?.data_retention || "365"} onChange={(e) => handleInputChange('system', 'data_retention', e.target.value)}>
                           <option value="90">90 Days (Cold Archive)</option>
                           <option value="365">1 Year Persistence</option>
                           <option value="unlimited">Infinite - No Purging</option>
                         </select>
                       </div>

                       <div className="flex items-center justify-between p-4 bg-[#fff5f5] border border-[#ffcdd2] rounded-sm">
                          <div>
                             <div className="text-[12px] font-bold text-[#c62828] uppercase tracking-tight">Mainframe Lockdown</div>
                             <div className="text-[10px] text-[#e57373]">Force maintenance mode across all public interfaces.</div>
                          </div>
                          <button 
                             onClick={() => handleInputChange('system', 'maintenance_mode', localSettings.system?.maintenance_mode === "1" ? "0" : "1")}
                             className={`group relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${localSettings.system?.maintenance_mode === "1" ? 'bg-[#c62828]' : 'bg-[#e57373]'}`}
                          >
                             <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${localSettings.system?.maintenance_mode === "1" ? 'translate-x-[22px]' : 'translate-x-[4px]'}`} />
                          </button>
                       </div>
                    </div>

                    <div className="bg-[#f0f9f1] border border-[#a5d6a7] rounded-sm p-6 space-y-6">
                       <div className="flex items-center gap-2 mb-2">
                          <i className="fas fa-shield-alt text-[#2e7d32] text-[16px]" />
                          <div className="text-[12px] font-bold text-[#1b5e20] uppercase font-sans tracking-wide">Infrastructure Health</div>
                       </div>
                       
                       <div className="flex items-center justify-between">
                          <div className="text-[13px] font-bold text-[#2e7d32]">Scheduled Snapshots</div>
                          <button 
                             onClick={() => handleInputChange('system', 'auto_backup_enabled', localSettings.system?.auto_backup_enabled === "1" ? "0" : "1")}
                             className={`group relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${localSettings.system?.auto_backup_enabled === "1" ? 'bg-[#2e7d32]' : 'bg-[#a5d6a7]'}`}
                          >
                             <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${localSettings.system?.auto_backup_enabled === "1" ? 'translate-x-[22px]' : 'translate-x-[4px]'}`} />
                          </button>
                       </div>
                       
                       <div className="space-y-1.5">
                         <label className="erp-label !text-[#388e3c]">Disaster Recovery Frequency</label>
                         <select className="erp-select border-[#a5d6a7] bg-white h-8" disabled={localSettings.system?.auto_backup_enabled !== "1"} value={localSettings.system?.backup_frequency || "daily"} onChange={(e) => handleInputChange('system', 'backup_frequency', e.target.value)}>
                           <option value="hourly">Every Hour (Hot Sync)</option>
                           <option value="daily">Daily Master Snapshot</option>
                           <option value="weekly">Weekly Compilation</option>
                         </select>
                       </div>
                       <p className="text-[10px] text-[#4caf50] italic leading-tight">Automated backups are stored in encrypted cloud S3 buckets with 99.9% durability.</p>
                    </div>
                 </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* CHANGE PASSWORD MODAL */}
      <FormModal 
        show={showPasswordModal} 
        title="Administrative Security" 
        size="md" 
        onClose={() => setShowPasswordModal(false)}
      >
        <form onSubmit={handlePasswordSubmit} className="space-y-6">
           <div className="bg-[#fff8e1] border-l-4 border-l-[#f57f17] p-4 text-[11px] text-[#795548] leading-relaxed">
              Updating your administrative secret will terminate all current sessions except for the present one. Ensure your new secret is complex.
           </div>
           
           <div className="space-y-4">
              <div>
                 <label className="erp-label">Challenge Verification</label>
                 <div className="relative">
                    <i className="fas fa-lock absolute left-3 top-1/2 -translate-y-1/2 text-[#90a4ae] text-[11px]" />
                    <input 
                       type="password" 
                       className="erp-input pl-9" 
                       placeholder="Current Password"
                       value={passwordForm.current_password}
                       onChange={(e) => setPasswordForm(p => ({...p, current_password: e.target.value}))}
                    />
                 </div>
              </div>
              <div>
                 <label className="erp-label">New Access Secret</label>
                 <div className="relative">
                    <i className="fas fa-key absolute left-3 top-1/2 -translate-y-1/2 text-[#90a4ae] text-[11px]" />
                    <input 
                       type="password" 
                       className="erp-input pl-9" 
                       placeholder="New Password"
                       value={passwordForm.new_password}
                       onChange={(e) => setPasswordForm(p => ({...p, new_password: e.target.value}))}
                    />
                 </div>
              </div>
              <div>
                 <label className="erp-label">Confirm New Secret</label>
                 <div className="relative">
                    <i className="fas fa-check-double absolute left-3 top-1/2 -translate-y-1/2 text-[#90a4ae] text-[11px]" />
                    <input 
                       type="password" 
                       className="erp-input pl-9" 
                       placeholder="Confirm Password"
                       value={passwordForm.confirm_password}
                       onChange={(e) => setPasswordForm(p => ({...p, confirm_password: e.target.value}))}
                    />
                 </div>
              </div>
           </div>

           <div className="flex justify-end gap-3 pt-4 border-t border-[#eceff1]">
              <button type="button" className="erp-button-secondary" onClick={() => setShowPasswordModal(false)}>Cancel</button>
              <button type="submit" className="erp-button-primary" disabled={passwordMutation.isPending}>
                 {passwordMutation.isPending ? <i className="fas fa-spinner animate-spin mr-2" /> : <i className="fas fa-shield-alt mr-2" />}
                 Update Credentials
              </button>
           </div>
        </form>
      </FormModal>
    </div>
  );
}
