import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Compass, MessageCircle, User, CalendarDays, Users } from 'lucide-react';

export default function Layout() {
  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-white">
      <main className="flex-1 overflow-y-auto pb-16">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 w-full bg-zinc-900 border-t border-zinc-800 flex justify-around items-center h-16 px-2 z-50">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `flex flex-col items-center p-2 ${isActive ? 'text-rose-500' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Compass className="w-6 h-6" />
          <span className="text-[10px] mt-1 font-medium">Grid</span>
        </NavLink>
        <NavLink
          to="/chats"
          className={({ isActive }) => `flex flex-col items-center p-2 ${isActive ? 'text-rose-500' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <MessageCircle className="w-6 h-6" />
          <span className="text-[10px] mt-1 font-medium">Chats</span>
        </NavLink>
        <NavLink
          to="/events"
          className={({ isActive }) => `flex flex-col items-center p-2 ${isActive ? 'text-rose-500' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <CalendarDays className="w-6 h-6" />
          <span className="text-[10px] mt-1 font-medium">Events</span>
        </NavLink>
        <NavLink
          to="/tribes"
          className={({ isActive }) => `flex flex-col items-center p-2 ${isActive ? 'text-rose-500' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Users className="w-6 h-6" />
          <span className="text-[10px] mt-1 font-medium">Tribes</span>
        </NavLink>
        <NavLink
          to="/profile"
          className={({ isActive }) => `flex flex-col items-center p-2 ${isActive ? 'text-rose-500' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <User className="w-6 h-6" />
          <span className="text-[10px] mt-1 font-medium">Profile</span>
        </NavLink>
      </nav>
    </div>
  );
}
