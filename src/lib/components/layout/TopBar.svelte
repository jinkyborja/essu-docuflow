<script lang="ts">
 import { page } from '$app/stores';
 import { goto } from '$app/navigation';
 import RowMenu from '$lib/components/ui/RowMenu.svelte';
 import Button from '$lib/components/ui/Button.svelte';
 import { showToast } from '$lib/stores/toasts';
 import { sidebarCollapsed, sidebarMobileOpen } from '$lib/stores/sidebar';
 import { notifUnreadCount } from '$lib/stores/notifications';
 const user = $derived($page.data.layoutUser);
 const student = $derived($page.url.pathname.startsWith('/student'));
 const menuItems = $derived([{label:'My Profile',href:student ? '/student/profile':'/staff/profile'}, {label:'Log out',onselect:()=>void logout()}]);
 async function logout() { try { const response = await fetch('/api/logout',{method:'POST'}); if(!response.ok) throw new Error('Could not log out. Please try again.'); await goto('/login'); } catch(error) { showToast(error instanceof Error ? error.message:'Could not log out. Please try again.','error'); } }
</script>
<header class="portal-topbar" class:collapsed={$sidebarCollapsed}>
 <div class="mobile-toggle"><Button variant="ghost" ariaLabel="Toggle navigation" title="Toggle navigation" icon="fa-solid fa-bars" onclick={()=>sidebarMobileOpen.update(value=>!value)} ariaExpanded={$sidebarMobileOpen} /></div>
 <div class="desktop-toggle"><Button variant="ghost" ariaLabel={$sidebarCollapsed ? 'Expand navigation':'Collapse navigation'} title="Toggle navigation (Ctrl+B)" icon="fa-solid fa-bars-staggered" onclick={()=>sidebarCollapsed.update(value=>!value)} /></div>
 <div class="topbar-actions"><a class="notification-bell" href={student ? '/student/notifications':'/staff/notifications'} aria-label={$notifUnreadCount ? 'Notifications, '+$notifUnreadCount+' unread':'Notifications'} title="Notifications"><i class="fa-regular fa-bell" aria-hidden="true"></i>{#if $notifUnreadCount > 0}<span>{$notifUnreadCount > 99 ? '99+':$notifUnreadCount}</span>{/if}</a>
 <RowMenu items={menuItems} label="Account menu" triggerClass="topbar-user-trigger">
  {#snippet triggerContent()}<span class="avatar">{user?.initials ?? '?'}</span><span class="topbar-name">{user?.name ?? 'User'}</span><i class="fa-solid fa-chevron-down" aria-hidden="true"></i>{/snippet}
  {#snippet header()}<strong>{user?.name}</strong><p>{student ? user?.program : user?.position}</p>{/snippet}
 </RowMenu></div>
</header>
<style>
 .portal-topbar { position: fixed; inset: 0 0 auto 248px; z-index: 20; height: 64px; display: flex; align-items: center; justify-content: space-between; padding: 0 var(--space-6); background: var(--color-surface); border-bottom: 1px solid var(--color-border); transition: left var(--motion-fast); }
 .portal-topbar.collapsed { left:72px; } .topbar-actions { margin-left:auto; display:flex; align-items:center; gap:var(--space-3); min-width:0; } .mobile-toggle {display:none;}
 .notification-bell { position:relative; width:40px; height:40px; flex-shrink:0; display:grid; place-items:center; color:var(--color-text-muted); border-radius:var(--radius-control); } .notification-bell:hover {background:var(--color-primary-soft);color:var(--color-primary);} .notification-bell > span {position:absolute;top:0;right:0;min-width:20px;border-radius:var(--radius-pill);padding:0 var(--space-1);background:var(--color-primary);color:var(--color-surface);font-size:var(--type-helper);text-align:center;}
 .avatar {display:grid;place-items:center;width:32px;height:32px;flex-shrink:0;border-radius:var(--radius-pill);background:var(--color-primary);color:var(--color-surface);font-size:var(--type-helper);font-weight:var(--weight-semibold);} .topbar-name {max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--type-body);} :global(.topbar-user-trigger) {border:0!important;} .topbar-actions :global(.row-menu-trigger) {max-width:100%;} .topbar-actions :global(.row-menu-trigger > i) {font-size:12px;}
 @media(max-width:1023px) {.portal-topbar,.portal-topbar.collapsed {left:0;} .mobile-toggle {display:block;} .desktop-toggle {display:none;}}
 @media(max-width:639px) {.portal-topbar {padding-inline:var(--space-4);} .topbar-name {display:none;}}
 @media(pointer:coarse) {.notification-bell {width:44px;height:44px;}}
</style>
