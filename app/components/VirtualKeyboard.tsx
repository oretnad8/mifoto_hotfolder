"use client";

import React from "react";

interface VirtualKeyboardProps {
    onKeyPress: (key: string) => void;
    onDelete: () => void;
    onClose: () => void;
    isVisible: boolean;
}

const KEYS = [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ñ"],
    ["Z", "X", "C", "V", "B", "N", "M", ",", "."],
];

export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({
    onKeyPress,
    onDelete,
    onClose,
    isVisible,
}) => {
    if (!isVisible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] p-4 transition-transform duration-300 transform translate-y-0 pb-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-2 px-2">
                    <span className="text-gray-400 text-xs">Teclado Virtual</span>
                    <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-800">
                        <i className="ri-arrow-down-s-line text-2xl"></i>
                    </button>
                </div>

                <div className="flex flex-col gap-2">
                    {KEYS.map((row, rowIndex) => (
                        <div key={rowIndex} className="flex justify-center gap-1 sm:gap-2">
                            {row.map((key) => (
                                <button
                                    key={key}
                                    onClick={() => onKeyPress(key)}
                                    className="bg-white hover:bg-gray-50 active:bg-gray-200 text-[#2D3A52] font-semibold text-lg sm:text-xl rounded-lg shadow-sm border-b-2 border-gray-200 active:border-b-0 active:translate-y-0.5 h-12 w-8 sm:h-14 sm:w-12 flex items-center justify-center transition-all"
                                >
                                    {key}
                                </button>
                            ))}
                        </div>
                    ))}

                    {/* Bottom Row: Space & Actions */}
                    <div className="flex justify-center gap-2 mt-1">
                        <button
                            onClick={() => onKeyPress(" ")}
                            className="bg-white hover:bg-gray-50 active:bg-gray-200 text-[#2D3A52] font-medium rounded-lg shadow-sm border-b-2 border-gray-200 active:border-b-0 active:translate-y-0.5 h-12 sm:h-14 flex-1 max-w-md flex items-center justify-center"
                        >
                            Espacio
                        </button>
                        <button
                            onClick={onDelete}
                            className="bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-600 font-medium rounded-lg shadow-sm border-b-2 border-red-200 active:border-b-0 active:translate-y-0.5 h-12 sm:h-14 w-20 sm:w-24 flex items-center justify-center"
                        >
                            <i className="ri-delete-back-2-line text-xl"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
