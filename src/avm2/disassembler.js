var IndentingWriter = (function () {
    function indentingWriter(suppressOutput) {
        this.tab = "  ";
        this.padding = "";
        this.suppressOutput = suppressOutput;
    }
    
    indentingWriter.prototype.writeLn = function writeLn(str) {
        if (!this.suppressOutput) {
            console.info(this.padding + str);
        }
    };
    
    indentingWriter.prototype.enter = function enter(str) {
        if (!this.suppressOutput) {
            console.info(this.padding + str);
        }
        this.indent();
    };
    
    indentingWriter.prototype.leave = function leave(str) {
        this.outdent();
        if (!this.suppressOutput) {
            console.info(this.padding + str);
        }
    };
    
    indentingWriter.prototype.indent = function indent() {
        this.padding += this.tab;
    };
    
    indentingWriter.prototype.outdent = function outdent() {
        if (this.padding.length > 0) {
            this.padding = this.padding.substring(0, this.padding.length - this.tab.length);
        }
    };
    
    indentingWriter.prototype.writeArray = function writeArray(arr) {
        for (var i = 0; i < arr.length; i++) {
            this.writeLn(("" + i).padRight(' ', 3) + arr[i]);
        }
    };
    
    return indentingWriter;
})();

function getFlags(value, flags) {
    var str = "";
    for (var i = 0; i < flags.length; i++) {
        if (value & (1 << i)) {
            str += flags[i] + " ";
        }
    }
    if (str.length == 0) {
        return "NONE";
    }
    return str;
}

function traceConstantPool(writer, constantPool) {
    writer.enter("constantPool {");
    for (var key in constantPool) {
        if (constantPool[key] instanceof Array) {
            writer.enter(key + " {");
            writer.writeArray(constantPool[key]);
            writer.leave("}");
        }
    }
    writer.leave("}");
}
        
function traceMethodInfo(writer, constantPool, methodInfo) {
    var mi = methodInfo;
    writer.enter("methodInfo {");
    writer.writeLn("name: " + mi.name);
    writer.writeLn("flags: " + getFlags(mi.flags, "NEED_ARGUMENTS|NEED_ACTIVATION|NEED_REST|HAS_OPTIONAL|||SET_DXN|HAS_PARAM_NAMES".split("|")));
    writer.leave("}");
}

function traceOperand(operand, constantPool, code) {
    var value = 0;
    switch(operand.size) {
        case "u08": value = code.readU8(); break;
        case "s16": value = code.readU30Unsafe(); break;
        case "s24": value = code.readS24(); break;
        case "u30": value = code.readU30(); break;
        case "u32": value = code.readU32(); break;
        default: assert (false); break;
    }
    var description = "";
    switch(operand.type) {
        case "": break;
        case "I": description = constantPool.ints[value]; break;
        case "U": description = constantPool.uints[value]; break;
        case "D": description = constantPool.doubles[value]; break;
        case "S": description = constantPool.strings[value]; break;
        case "N": description = constantPool.namespaces[value]; break;
        case "M": 
            return constantPool.multinames[value]; 
        default: detail = "?"; break;
    }
    return operand.name + ":" + value + (description == "" ? "" : " (" + description + ")");
    
}

function traceOperands(opcode, constantPool, code, rewind) {
    rewind = rewind || false;
    var old = code.position;
    var str = "";
    for (var i = 0; i < opcode.operands.length; i++) {
        str += traceOperand(opcode.operands[i], constantPool, code);
        if (i < opcode.operands.length - 1) {
            str += ", ";
        }
    }
    if (rewind) {
        code.seek(old);
    }
    return str;
}

function traceMethodBodyInfo(writer, constantPool, methodBodyInfo) {
    var mbi = methodBodyInfo;
    writer.enter("methodBodyInfo {");
    traceMethodInfo(writer, constantPool, mbi.methodInfo);
    
    var code = new ABCStream(mbi.code);
    
    
    
    writer.enter("code {");
    while (code.remaining() > 0) {
        var bc = code.readU8();
        var opcode = opcodeTable[bc];
        var str, defaultOffset, offset, count;
        str = ("" + code.position).padRight(' ', 5);
        switch (bc) {
            case OP_lookupswitch:
                str += opcode.name + ": defaultOffset: " + code.readS24();
                count = code.readU30() + 1;
                for (var i = 0; i < count; i++) {
                    str += " offset: " + code.readS24();
                }
                writer.writeLn(str);
                break;
            default:
                if (opcode) {
                    str += opcode.name.padRight(' ', 20);
                    if (!opcode.operands) {
                        assert(false, "Opcode: " + opcode.name + " has undefined operands.");
                    } else {
                        if (opcode.operands.length > 0) {
                            str += traceOperands(opcode, constantPool, code);
                        }
                        writer.writeLn(str);
                    }
                } else {
                    assert(false, "Opcode: " + bc + " is not implemented.");
                }
                break;
        }
    }
    writer.leave("}");
    
    writer.leave("}");
}