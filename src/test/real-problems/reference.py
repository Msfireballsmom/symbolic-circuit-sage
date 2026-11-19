#!/usr/bin/env python3
"""
Independent reference answers for the Circuit Sage real-problem benchmark.

Nothing here imports or ports the app's code. DC answers come from a fresh
modified-nodal-analysis written below with numpy; first-order answers come from
closed-form Thevenin/τ formulas evaluated by hand; second-order answers come
from numpy.roots of the characteristic polynomial and scipy's matrix
exponential of the state equations (a different method from the app's
closed-form coefficients).

Run:  python3 src/test/real-problems/reference.py > src/test/real-problems/expected.ts
Requires numpy + scipy.
"""
import json, math
import numpy as np
from scipy.linalg import expm

# ---------------------------------------------------------------------------
# Problem definitions. Netlist convention (stated in every problem's text):
#   ('R'|'C'|'L', label, value, a, b)  passive between nodes a and b
#   ('V', label, value, a, b)          voltage source, + terminal at a
#   ('I', label, value, a, b)          current source, arrow drives current INTO node a
# Node 0 is ground.
# ---------------------------------------------------------------------------

P = []
def dc(id, mirrors, text, net, asks, source=None, tag="original"):
    P.append(dict(id=id, kind="dc", mirrors=mirrors, text=text, netlist=net, asks=asks, source=source, tag=tag))
def tr(id, mirrors, text, net, storage, init, source=None, tag="original"):
    P.append(dict(id=id, kind="first_order", mirrors=mirrors, text=text, netlist=net, storage=storage, init=init, source=source, tag=tag))
def rlc(id, mirrors, text, spec, source=None, tag="original"):
    P.append(dict(id=id, kind="rlc", mirrors=mirrors, text=text, rlc=spec, source=source, tag=tag))
def refuse(id, mirrors, text, why, path="sage", rlcspec=None, source=None, tag="original"):
    P.append(dict(id=id, kind="refusal", mirrors=mirrors, text=text, why=why, path=path, rlc=rlcspec, source=source, tag=tag))

# ---- Ohm's law with power -----------------------------------------------------
dc("OHM-1", "Boylestad/Nilsson Ch.2-style Ohm's law + power",
   "A 9 V battery is connected across a single 450 Ω resistor. Find the current in the circuit and the power the resistor absorbs.",
   [("V","Vs",9,1,0),("R","R1",450,1,0)], [("I","R1"),("P","R1")])
dc("OHM-2", "Nilsson Ch.2-style Ohm's law + power",
   "Ohm's law. A resistor R = 2.2 kΩ is connected directly across a source Vs = 15 V. Determine the current through the resistor and the power dissipated in it.",
   [("V","Vs",15,1,0),("R","R1",2200,1,0)], [("I","R1"),("P","R1")])
dc("OHM-3", "Hayt Ch.2-style current source into one resistor",
   "A 3 mA current source drives a 4.7 kΩ resistor connected across its terminals. Find the voltage across the resistor and the power it absorbs.",
   [("I","Is",0.003,1,0),("R","R1",4700,1,0)], [("V","R1"),("P","R1")])
dc("OHM-4", "Alexander/Sadiku Ch.2-style series string, Ohm's law",
   "Ohm's law. Vs = 48 V drives R1 = 120 Ω and R2 = 360 Ω in series. Find the current through each resistor and the power absorbed by R2.",
   [("V","Vs",48,1,0),("R","R1",120,1,2),("R","R2",360,2,0)], [("I","R1"),("I","R2"),("P","R2")])

# ---- Voltage dividers -----------------------------------------------------------
dc("VDIV-1", "Nilsson Ch.3-style voltage divider, 2 resistors",
   "Find the voltage across R2 using voltage divider. Vs = 24 V, R1 = 6.8 kΩ, R2 = 3.3 kΩ in series.",
   [("V","Vs",24,1,0),("R","R1",6800,1,2),("R","R2",3300,2,0)], [("V","R2"),("I","R1")])
dc("VDIV-2", "Nilsson Ch.3-style voltage divider, 3 resistors",
   "A 12 V supply feeds three resistors in series: R1 = 1 kΩ, R2 = 2.2 kΩ, R3 = 4.7 kΩ. Using the voltage divider rule, find the voltage across each resistor.",
   [("V","Vs",12,1,0),("R","R1",1000,1,2),("R","R2",2200,2,3),("R","R3",4700,3,0)], [("V","R1"),("V","R2"),("V","R3")])
dc("VDIV-3", "Boylestad Ch.5-style divider with source current",
   "Voltage divider: Vs = 5 V, R1 = 10 kΩ, R2 = 15 kΩ in series. Find the output voltage across R2 and the current drawn from the source.",
   [("V","Vs",5,1,0),("R","R1",10000,1,2),("R","R2",15000,2,0)], [("V","R2"),("I","R2")])
dc("VDIV-4", "Hayt Ch.3-style 4-resistor divider with power",
   "Four resistors are in series across Vs = 30 V: R1 = 100 Ω, R2 = 200 Ω, R3 = 300 Ω, R4 = 400 Ω. Find the voltage across R3 and the power absorbed by R4.",
   [("V","Vs",30,1,0),("R","R1",100,1,2),("R","R2",200,2,3),("R","R3",300,3,4),("R","R4",400,4,0)], [("V","R3"),("P","R4")])

# ---- Current dividers -----------------------------------------------------------
dc("IDIV-1", "Nilsson Ch.3-style current divider, 2 branches",
   "Current divider. Is = 10 mA feeds R1 = 2 kΩ and R2 = 3 kΩ connected in parallel. Find the current through each resistor.",
   [("I","Is",0.010,1,0),("R","R1",2000,1,0),("R","R2",3000,1,0)], [("I","R1"),("I","R2")])
dc("IDIV-2", "Alexander/Sadiku Ch.2-style 3-branch parallel",
   "An ideal 2 A current source is connected across three parallel resistors R1 = 10 Ω, R2 = 20 Ω and R3 = 40 Ω. Find the voltage across the combination and the current in each resistor.",
   [("I","Is",2,1,0),("R","R1",10,1,0),("R","R2",20,1,0),("R","R3",40,1,0)], [("V","R1"),("I","R1"),("I","R2"),("I","R3")])
dc("IDIV-3", "Hayt Ch.3-style current divider with power",
   "Using the current divider rule, Is = 0.5 A splits between R1 = 120 Ω and R2 = 80 Ω connected in parallel. Find the current in R1 and the power absorbed by R2.",
   [("I","Is",0.5,1,0),("R","R1",120,1,0),("R","R2",80,1,0)], [("I","R1"),("I","R2"),("P","R2")])

# ---- DC nodal / multi-node -------------------------------------------------------
dc("NOD-1", "Nilsson Ch.4-style nodal, 1 essential node, two voltage sources",
   "Use nodal analysis. V1 = 10 V between node 1 and ground (+ at node 1). V2 = 5 V between node 3 and ground (+ at node 3). R1 = 2 Ω between node 1 and node 2, R2 = 4 Ω between node 2 and ground, R3 = 4 Ω between node 2 and node 3. Find the node voltages and the current in each resistor.",
   [("V","V1",10,1,0),("V","V2",5,3,0),("R","R1",2,1,2),("R","R2",4,2,0),("R","R3",4,2,3)], [("N",2),("I","R1"),("I","R2"),("I","R3")])
dc("NOD-2", "Nilsson Ch.4-style nodal, current source, 2 nodes",
   "Use nodal analysis. Is = 4 A between node 1 and ground, arrow into node 1. R1 = 5 Ω between node 1 and ground, R2 = 10 Ω between node 1 and node 2, R3 = 10 Ω between node 2 and ground. Find the node voltages.",
   [("I","Is",4,1,0),("R","R1",5,1,0),("R","R2",10,1,2),("R","R3",10,2,0)], [("N",1),("N",2),("I","R3")])
dc("NOD-3", "Hayt Ch.4-style nodal, 3 nodes, voltage source",
   "Use nodal analysis. Vs = 12 V between node 1 and ground. R1 = 1 kΩ between node 1 and node 2, R2 = 2 kΩ between node 2 and ground, R3 = 1 kΩ between node 2 and node 3, R4 = 3 kΩ between node 3 and ground. Find the node voltages and the current through R4.",
   [("V","Vs",12,1,0),("R","R1",1000,1,2),("R","R2",2000,2,0),("R","R3",1000,2,3),("R","R4",3000,3,0)], [("N",2),("N",3),("I","R4")])
dc("NOD-4", "Alexander/Sadiku Ch.3-style nodal, two current sources",
   "Nodal analysis. I1 = 3 A between node 1 and ground, arrow into node 1. I2 = 2 A between node 2 and ground, arrow into node 2. R1 = 2 Ω between node 1 and ground, R2 = 4 Ω between node 1 and node 2, R3 = 8 Ω between node 2 and ground. Find the node voltages.",
   [("I","I1",3,1,0),("I","I2",2,2,0),("R","R1",2,1,0),("R","R2",4,1,2),("R","R3",8,2,0)], [("N",1),("N",2)])
dc("NOD-5", "Nilsson Ch.4-style nodal, bridge (unbalanced Wheatstone)",
   "Use nodal analysis. Vs = 10 V between node 1 and ground. R1 = 100 Ω between node 1 and node 2, R2 = 200 Ω between node 1 and node 3, R3 = 300 Ω between node 2 and ground, R4 = 150 Ω between node 3 and ground, R5 = 50 Ω between node 2 and node 3. Find the node voltages and the current through R5.",
   [("V","Vs",10,1,0),("R","R1",100,1,2),("R","R2",200,1,3),("R","R3",300,2,0),("R","R4",150,3,0),("R","R5",50,2,3)], [("N",2),("N",3),("I","R5")])
dc("NOD-6", "Nilsson Ch.4-style nodal, mixed V and I sources",
   "Use nodal analysis. Vs = 20 V between node 1 and ground. Is = 1 A between node 3 and ground, arrow into node 3. R1 = 10 Ω between node 1 and node 2, R2 = 20 Ω between node 2 and ground, R3 = 10 Ω between node 2 and node 3, R4 = 5 Ω between node 3 and ground. Find the node voltages and the power absorbed by R4.",
   [("V","Vs",20,1,0),("I","Is",1,3,0),("R","R1",10,1,2),("R","R2",20,2,0),("R","R3",10,2,3),("R","R4",5,3,0)], [("N",2),("N",3),("P","R4")])
dc("NOD-7", "Hayt Ch.4-style ladder network, 4 nodes",
   "Use nodal analysis on the ladder. Vs = 15 V between node 1 and ground. R1 = 1 kΩ between node 1 and node 2, R2 = 2 kΩ between node 2 and ground, R3 = 1 kΩ between node 2 and node 3, R4 = 2 kΩ between node 3 and ground, R5 = 1 kΩ between node 3 and node 4, R6 = 2 kΩ between node 4 and ground. Find the node voltages.",
   [("V","Vs",15,1,0),("R","R1",1000,1,2),("R","R2",2000,2,0),("R","R3",1000,2,3),("R","R4",2000,3,0),("R","R5",1000,3,4),("R","R6",2000,4,0)], [("N",2),("N",3),("N",4)])
dc("NOD-8", "Nilsson Ch.4-style nodal, floating voltage source (supernode)",
   "Use nodal analysis. V1 = 12 V between node 1 and ground. V2 = 6 V between node 2 and node 3 (+ at node 2). R1 = 4 Ω between node 1 and node 2, R2 = 6 Ω between node 3 and ground, R3 = 3 Ω between node 2 and ground. Find the node voltages.",
   [("V","V1",12,1,0),("V","V2",6,2,3),("R","R1",4,1,2),("R","R2",6,3,0),("R","R3",3,2,0)], [("N",2),("N",3),("I","R2")])
dc("NOD-9", "Alexander/Sadiku Ch.3-style nodal, opposing sources",
   "Nodal analysis. V1 = 9 V between node 1 and ground. V2 = 3 V between node 3 and ground. R1 = 3 Ω between node 1 and node 2, R2 = 6 Ω between node 2 and ground, R3 = 2 Ω between node 2 and node 3. Find the voltage at node 2 and the current through R3.",
   [("V","V1",9,1,0),("V","V2",3,3,0),("R","R1",3,1,2),("R","R2",6,2,0),("R","R3",2,2,3)], [("N",2),("I","R3"),("I","R1")])

# ---- First-order RC / RL step and natural responses -------------------------------
tr("RC-1", "Nilsson Ch.7-style RC step response",
   "RC transient circuit. R = 10 kΩ, C = 47 μF, Vs = 5 V, v(0) = 0 V. The source is switched on at t = 0. Find the time constant and the capacitor voltage.",
   [("V","Vs",5,1,0),("R","R1",10000,1,2),("C","C1",47e-6,2,0)], ("C","C1",2), 0.0)
tr("RC-2", "Hayt Ch.8-style RC charging with initial voltage",
   "RC step response. Vs = 12 V, R = 2.2 kΩ, C = 100 μF, initial capacitor voltage v(0) = 3 V. The switch closes at t = 0. Find the time constant and the capacitor voltage.",
   [("V","Vs",12,1,0),("R","R1",2200,1,2),("C","C1",100e-6,2,0)], ("C","C1",2), 3.0)
tr("RC-3", "Nilsson Ch.7-style RC natural response (discharge)",
   "Transient: a capacitor C1 = 5 μF charged to v(0) = 10 V discharges through R1 = 2 kΩ. R1 = 2 kΩ between node 1 and ground, C1 = 5 μF between node 1 and ground. Find the time constant and the capacitor voltage after t = 0.",
   [("R","R1",2000,1,0),("C","C1",5e-6,1,0)], ("C","C1",1), 10.0)
tr("RC-4", "Alexander/Sadiku Ch.7-style RC with Thevenin resistance",
   "Transient: Vs = 20 V between node 1 and ground, R1 = 4 kΩ between node 1 and node 2, R2 = 4 kΩ between node 2 and ground, C1 = 10 μF between node 2 and ground, v(0) = 0 V. The source is applied at t = 0. Find the time constant and the capacitor voltage.",
   [("V","Vs",20,1,0),("R","R1",4000,1,2),("R","R2",4000,2,0),("C","C1",10e-6,2,0)], ("C","C1",2), 0.0)
tr("RL-1", "Nilsson Ch.7-style RL step response",
   "RL transient circuit. Vs = 12 V, R = 4 Ω, L = 2 H, i(0) = 0 A. The switch closes at t = 0. Find the time constant and the inductor current.",
   [("V","Vs",12,1,0),("R","R1",4,1,2),("L","L1",2,2,0)], ("L","L1",None), 0.0)
tr("RL-2", "Hayt Ch.8-style RL step with initial current",
   "RL step response. Vs = 24 V, R = 8 Ω, L = 400 mH, initial inductor current i(0) = 1 A. The source is applied at t = 0. Find the time constant and the inductor current.",
   [("V","Vs",24,1,0),("R","R1",8,1,2),("L","L1",0.4,2,0)], ("L","L1",None), 1.0)
tr("RL-3", "Nilsson Ch.7-style RL natural response",
   "Transient: an inductor L1 = 50 mH carrying i(0) = 2 A is connected across R1 = 10 Ω at t = 0. R1 = 10 Ω between node 1 and ground, L1 = 50 mH between node 1 and ground. Find the time constant and the inductor current.",
   [("R","R1",10,1,0),("L","L1",0.05,1,0)], ("L","L1",None), 2.0)

# ---- Second-order RLC ---------------------------------------------------------------
rlc("RLC-1", "Nilsson Ch.8-style series RLC step, overdamped",
    "A series RLC circuit has R = 200 Ω, L = 50 mH and C = 20 μF. A Vs = 10 V step is applied at t = 0; the capacitor is initially uncharged, v_C(0) = 0 V, and i_L(0) = 0 A. Find v_C(t).",
    dict(topology="series", excitation="step", R=200, L=0.05, C=20e-6, Vs=10, vC0=0, iL0=0))
rlc("RLC-2", "Nilsson Ch.8-style series RLC step, critically damped",
    "A series RLC circuit has R = 100 Ω, L = 50 mH and C = 20 μF. A Vs = 10 V step is applied at t = 0 with v_C(0) = 0 V and i_L(0) = 0 A. Find v_C(t) and state the type of damping.",
    dict(topology="series", excitation="step", R=100, L=0.05, C=20e-6, Vs=10, vC0=0, iL0=0))
rlc("RLC-3", "Nilsson Ch.8-style series RLC step, underdamped",
    "A series RLC circuit has R = 20 Ω, L = 50 mH and C = 20 μF. A Vs = 10 V step is applied at t = 0 with v_C(0) = 0 V and i_L(0) = 0 A. Find v_C(t), the damped frequency and the type of damping.",
    dict(topology="series", excitation="step", R=20, L=0.05, C=20e-6, Vs=10, vC0=0, iL0=0))
rlc("RLC-4", "Nilsson Ch.8-style series RLC natural, underdamped",
    "A source-free series RLC circuit has R = 10 Ω, L = 10 mH and C = 10 μF. At t = 0 the capacitor voltage is v_C(0) = 5 V and the loop current is i_L(0) = 0 A. Find v_C(t).",
    dict(topology="series", excitation="natural", R=10, L=0.01, C=10e-6, Vs=0, vC0=5, iL0=0))
rlc("RLC-5", "Nilsson Ch.8-style parallel RLC natural, overdamped",
    "A source-free parallel RLC circuit has R = 200 Ω, L = 50 mH and C = 0.2 μF. At t = 0, v_C(0) = 12 V and the inductor current, flowing from the top node down through L, is i_L(0) = 30 mA. Find v(t) and the roots of the characteristic equation.",
    dict(topology="parallel", excitation="natural", R=200, L=0.05, C=0.2e-6, Vs=0, vC0=12, iL0=0.03))
rlc("RLC-6", "Nilsson Ch.8-style parallel RLC natural, critically damped",
    "A source-free parallel RLC circuit has R = 250 Ω, L = 50 mH and C = 0.2 μF. At t = 0, v_C(0) = 12 V and i_L(0) = 0 A. Find v(t); show that the response is critically damped.",
    dict(topology="parallel", excitation="natural", R=250, L=0.05, C=0.2e-6, Vs=0, vC0=12, iL0=0))
rlc("RLC-7", "Nilsson Ch.8-style parallel RLC natural, underdamped",
    "A source-free parallel RLC circuit has R = 20 kΩ, L = 8 H and C = 0.125 μF. At t = 0, v_C(0) = 10 V and i_L(0) = 0 A. Find v(t) and the damped radian frequency.",
    dict(topology="parallel", excitation="natural", R=20000, L=8, C=0.125e-6, Vs=0, vC0=10, iL0=0))
rlc("RLC-8", "Alexander/Sadiku Ch.8-style series RLC step with initial energy",
    "A series RLC circuit has R = 40 Ω, L = 0.1 H and C = 100 μF. The capacitor starts at v_C(0) = 2 V and i_L(0) = 0.1 A. A Vs = 12 V step is applied at t = 0. Find v_C(t).",
    dict(topology="series", excitation="step", R=40, L=0.1, C=100e-6, Vs=12, vC0=2, iL0=0.1))


# ---- Plain-language phrasings (how students actually type homework) ------------------
dc("PLAIN-1", "Boylestad Ch.5-style divider, words only",
   "A 10 V source is in series with a 2 kΩ resistor and a 3 kΩ resistor. What is the voltage across the 3 kΩ resistor?",
   [("V","Vs",10,1,0),("R","R1",2000,1,2),("R","R2",3000,2,0)], [("V","R2")])
dc("PLAIN-2", "Floyd Ch.5-style series string, subscripts and no Ω",
   "Find the current I through each resistor: R₁ = 4.7k, R₂ = 10k in series with a 9V battery.",
   [("V","Vs",9,1,0),("R","R1",4700,1,2),("R","R2",10000,2,0)], [("I","R1"),("I","R2")])
dc("PLAIN-3", "Floyd Ch.6-style parallel resistors on a battery",
   "Three resistors, 6 Ω, 3 Ω and 2 Ω, are connected in parallel across a 12 V battery. Find the current through each resistor.",
   [("V","Vs",12,1,0),("R","R1",6,1,0),("R","R2",3,1,0),("R","R3",2,1,0)], [("I","R1"),("I","R2"),("I","R3")])
dc("PLAIN-4", "Hayt Ch.3-style parallel pair on a current source",
   "Two resistors R1 = 330 ohms and R2 = 470 ohms are in parallel, fed by a 25 mA current source. Find the voltage across them.",
   [("I","Is",0.025,1,0),("R","R1",330,1,0),("R","R2",470,1,0)], [("V","R1")])
dc("PLAIN-5", "Ohm's law, voltage 'applied' (no source keyword)",
   "What current flows when 5 V is applied across a 1.2 kΩ resistor? Also find the power.",
   [("V","Vs",5,1,0),("R","R1",1200,1,0)], [("I","R1"),("P","R1")])
tr("PLAIN-6", "Floyd Ch.12-style RC charging, words only",
   "In an RC charging circuit, R = 1 MΩ, C = 2.2 uF and the supply is 9 V. The capacitor starts uncharged. Find the time constant and the final capacitor voltage.",
   [("V","Vs",9,1,0),("R","R1",1e6,1,2),("C","C1",2.2e-6,2,0)], ("C","C1",2), 0.0)
tr("PLAIN-7", "Floyd Ch.13-style RL, words only",
   "An inductor of 100 mH in series with a 50 Ω resistor is connected to a 10 V DC source at t = 0. Initially no current flows. Find the time constant and the final current.",
   [("V","Vs",10,1,0),("R","R1",50,1,2),("L","L1",0.1,2,0)], ("L","L1",None), 0.0)
rlc("PLAIN-8", "Alexander/Sadiku Ch.8-style series RLC natural, words only",
    "A series RLC circuit with R = 8 Ω, L = 0.5 H and C = 0.02 F has its capacitor charged to 10 V at t = 0 with zero current. Determine the type of damping and v_C(t).",
    dict(topology="series", excitation="natural", R=8, L=0.5, C=0.02, Vs=0, vC0=10, iL0=0))

# ---- Must be refused ---------------------------------------------------------------
refuse("REF-FLOAT", "floating node",
       "Use nodal analysis. Vs = 10 V between node 1 and ground, R1 = 1 kΩ between node 1 and node 2, R2 = 2 kΩ between node 3 and node 4. Find the node voltages.",
       "R2 is not connected to the rest of the circuit; node 3/4 voltages are undefined.")
refuse("REF-MISSING", "missing value",
       "Find the current through R2. Vs = 12 V, R1 = 4 kΩ, R2 = ? in series.",
       "R2 has no value.")
refuse("REF-REQ", "equivalent resistance (no source)",
       "Find the equivalent resistance. R1 = 100 Ω, R2 = 220 Ω, R3 = 330 Ω in series.",
       "Equivalent resistance is not computed by the verified engine.")
refuse("REF-REQ-SRC", "equivalent resistance (source present)",
       "Vs = 10 V, R1 = 100 Ω, R2 = 220 Ω in series. Find the total resistance seen by the source.",
       "Resistance-only question; node voltages would answer a different question.")
refuse("REF-AC", "AC phasor",
       "AC phasor analysis. Vs = 120 V, f = 60 Hz, R = 100 Ω, L = 50 mH in series. Find the current phasor.",
       "AC is disabled.")
refuse("REF-OPAMP", "op-amp",
       "Inverting op-amp. Rf = 100 kΩ, Rin = 10 kΩ, Vin = 0.5 V. Find Vout.",
       "Op-amps are not modelled.")
refuse("REF-DIODE", "diode",
       "A silicon diode is in series with R = 1 kΩ across a 5 V source. Find the diode current.",
       "Diodes are not modelled.")
refuse("REF-MESH", "mesh (disabled tab)",
       "Mesh analysis with 2 meshes. Vs = 24 V, R1 = 2 kΩ in mesh 1, R2 = 4 kΩ shared between mesh 1 and mesh 2, R3 = 6 kΩ in mesh 2. Find the mesh currents.",
       "Mesh is disabled; text names a method with no verified path.")
refuse("REF-RLC-PSTEP", "parallel RLC step (current-source driven)",
       "A parallel RLC circuit with R = 500 Ω, L = 1 H and C = 1 μF is driven by a 10 mA current step applied at t = 0. Find v(t).",
       "Parallel step excitation is coming soon in the RLC tab.", path="rlc",
       rlcspec=dict(topology="parallel", excitation="step", R=500, L=1, C=1e-6, Vs=5, vC0=0, iL0=0))

# ---- ET310-sourced (public pages; paraphrased, numbers and topology kept) ------------
ET_LAB1 = "https://www.cliffsnotes.com/study-notes/31886352 (public preview) + https://www.studypool.com/discuss/22421323 (public lab handout preview)"
for tag_id, r4, posted in [("ET310-W1LAB-NOM",7000,"0.7 V"),("ET310-W1LAB-5LO",6650,"669.688 mV"),("ET310-W1LAB-5HI",7350,"729.891 mV"),("ET310-W1LAB-10LO",6300,"638.945 mV"),("ET310-W1LAB-10HI",7700,"759.369 mV")]:
    dc(tag_id, f"ET310 Week 1 lab (Voltage and Current Laws), load R4={r4} Ω; posted student answer {posted}",
       f"Use nodal analysis. Vs = 5 V between node 1 and ground. R1 = 25 kΩ between node 1 and node 2. R2 = 45 kΩ between node 2 and node 3. R3 = 30 kΩ between node 2 and node 3. R4 = {r4/1000:g} kΩ between node 3 and ground. Find the voltage Vx across the load resistor R4.",
       [("V","Vs",5,1,0),("R","R1",25000,1,2),("R","R2",45000,2,3),("R","R3",30000,2,3),("R","R4",r4,3,0)], [("V","R4")],
       source=ET_LAB1, tag="ET310-sourced")
dc("ET310-QUIZ1-Q1", "ET310 Week 1 quiz Q1 (I0 = 20 mA, V3 = 5 V, R1 = 100 Ω, R2 = 50 Ω; voltage across the current source). Diagram not public: single-loop topology ASSUMED",
   "Use nodal analysis. I0 = 20 mA between node 1 and ground, arrow into node 1. R1 = 100 Ω between node 1 and node 2. R2 = 50 Ω between node 2 and node 3. V3 = 5 V between node 3 and ground (+ at node 3). Find the voltage across the current source.",
   [("I","I0",0.020,1,0),("R","R1",100,1,2),("R","R2",50,2,3),("V","V3",5,3,0)], [("N",1)],
   source="https://www.coursehero.com/sitemap/schools/968-Grantham-University/courses/4877476-ET310/ (public listing text of ET310_Quiz_W1)", tag="ET310-sourced")
ET_AP81 = "https://www.studypool.com/discuss/41748174 (public ET310 W3-W4 task list: 'RLC Circuits Problem 8.1 (note for part c s2=-74641 rad/s)'); values are Nilsson 11e Assessment Problem 8.1 (parallel RLC, R = 100 Ω, L = 20 mH)"
for sub, C, damp in [("a",500e-9,"critically damped"),("b",1e-6,"underdamped"),("c",125e-9,"overdamped")]:
    rlc(f"ET310-AP8.1{sub}", f"ET310 Week 4 task, Nilsson AP 8.1({sub}) — parallel RLC roots, {damp}",
        f"A parallel RLC circuit has R = 100 Ω and L = 20 mH. With C = {C*1e9:g} nF, find the neper frequency, the resonant radian frequency and the roots of the characteristic equation, and state the type of response. Use v_C(0) = 1 V, i_L(0) = 0 A for the source-free response.",
        dict(topology="parallel", excitation="natural", R=100, L=0.02, C=C, Vs=0, vC0=1, iL0=0),
        source=ET_AP81, tag="ET310-sourced")
refuse("ET310-W2LAB-DEP", "ET310 Week 2 lab (Nilsson Ex. 4.48 mesh with dependent source 5·i1; 1 V source)",
       "Using mesh analysis, determine the current i1 and the power supplied by the 1 V source. Vs = 1 V, the circuit contains a dependent current source of 5 i1.",
       "Dependent sources and mesh are not on a verified path.", source="https://www.coursehero.com/file/129132573/ET310-W2LAB-00164040docx/ (public preview)", tag="ET310-sourced")
refuse("ET310-W3LAB-INT", "ET310 Week 3 lab (Nilsson Ex. 7.11 op-amp integrator)",
       "An op-amp integrator has Vs = 3 sin(200t) V, R1 = 20 kΩ, Cf = 5 μF and vc(0) = 1.5 V. Find the output voltage Vout.",
       "Op-amp/sinusoidal input not supported.", source="https://www.sweetstudy.com/sites/default/files/qx/17/07/19/07/week1-4.pdf (public search-index text)", tag="ET310-sourced")
refuse("ET310-EX3.2-DEP", "ET310 Assignment 2, Exercise 3-2 (nodal with dependent voltage source Va/2)",
       "Apply nodal analysis to find Va. A 9 V source, R1 = 20 Ω, R2 = 10 Ω, R3 = 40 Ω and a dependent voltage source of value Va/2.",
       "Dependent sources are not on a verified path.", source="https://www.cliffsnotes.com/study-notes/27605628 (public preview)", tag="ET310-sourced")

# ---------------------------------------------------------------------------
# Independent solvers
# ---------------------------------------------------------------------------
def mna(net, storage_state=None):
    """DC operating point. Capacitors open, inductors short (0 V branch).
    storage_state: optional {label: value} replacing a C with a V source / L with an I source."""
    nodes = sorted({n for c in net for n in (c[3], c[4]) if n != 0})
    idx = {n: i for i, n in enumerate(nodes)}
    vbr = [c for c in net if c[0] == 'V' or (c[0] == 'L' and not (storage_state and c[1] in storage_state)) or (c[0] == 'C' and storage_state and c[1] in storage_state)]
    N = len(nodes); M = N + len(vbr)
    A = np.zeros((M, M)); b = np.zeros(M)
    def I(n): return idx[n] if n != 0 else None
    for c in net:
        t, lab, val, a, bb = c
        ia, ib = I(a), I(bb)
        if t == 'R':
            g = 1.0 / val
            for p, q, s in ((ia, ia, g), (ib, ib, g), (ia, ib, -g), (ib, ia, -g)):
                if p is not None and q is not None: A[p, q] += s
        elif t == 'I' or (t == 'L' and storage_state and lab in storage_state):
            v = val if t == 'I' else storage_state[lab]
            # 'I' drives into node a. For an inductor carrying i from a to b, it pulls current out of a.
            if t == 'I':
                if ia is not None: b[ia] += v
                if ib is not None: b[ib] -= v
            else:
                if ia is not None: b[ia] -= v
                if ib is not None: b[ib] += v
    for k, c in enumerate(vbr):
        t, lab, val, a, bb = c
        r = N + k; ia, ib = I(a), I(bb)
        if ia is not None: A[ia, r] += 1; A[r, ia] += 1
        if ib is not None: A[ib, r] -= 1; A[r, ib] -= 1
        b[r] = val if t == 'V' else (storage_state[lab] if t == 'C' else 0.0)
    x = np.linalg.solve(A, b)
    V = {0: 0.0, **{n: x[idx[n]] for n in nodes}}
    br = {c[1]: x[N + k] for k, c in enumerate(vbr)}
    return V, br

def comp(net, lab): return next(c for c in net if c[1] == lab)

def dc_answers(p):
    V, _ = mna(p["netlist"])
    out = []
    for kind, ref in p["asks"]:
        if kind == "N":
            out.append(dict(q=f"V(node {ref})", kind="N", ref=ref, value=V[ref], unit="V"))
            continue
        c = comp(p["netlist"], ref); vab = V[c[3]] - V[c[4]]
        if kind == "V": out.append(dict(q=f"|V({ref})|", kind="V", ref=ref, value=abs(vab), unit="V"))
        if kind == "I": out.append(dict(q=f"|I({ref})|", kind="I", ref=ref, value=abs(vab / c[2]), unit="A"))
        if kind == "P": out.append(dict(q=f"P({ref}) absorbed", kind="P", ref=ref, value=vab * vab / c[2], unit="W"))
    return out

def first_order_answers(p):
    net = p["netlist"]; t, lab, node = p["storage"]; el = comp(net, lab); x0 = p["init"]
    others = [c for c in net if c[1] != lab]
    # R_th seen by the element: kill sources, inject 1 A test current a→ (into a, out of b).
    killed = [c for c in others if c[0] not in ('V', 'I')] + [("R", f"short_{c[1]}", 1e-12, c[3], c[4]) for c in others if c[0] == 'V']
    test = killed + [("I", "Itest", 1.0, el[3], el[4])]
    Vt, _ = mna(test)
    rth = Vt[el[3]] - Vt[el[4]]
    tau = rth * el[2] if t == 'C' else el[2] / rth
    if t == 'C':
        Vinf, _ = mna(net)
        xinf = Vinf[node]
        V0, _ = mna(net, {lab: x0}); x0p = V0[node]
        unit = "V"
    else:
        _, brinf = mna(net); xinf = brinf[lab]
        x0p = x0; unit = "A"
    return [dict(q="tau", kind="tau", value=tau, unit="s"),
            dict(q="x(0+)", kind="x0", value=x0p, unit=unit),
            dict(q="x(inf)", kind="xinf", value=xinf, unit=unit)]

def rlc_answers(s):
    R, L, C = s["R"], s["L"], s["C"]
    if s["topology"] == "series":
        poly = [1, R / L, 1 / (L * C)]
        A = np.array([[0, 1 / C], [-1 / L, -R / L]]); u = np.array([0, (s["Vs"] if s["excitation"] == "step" else 0) / L])
    else:
        poly = [1, 1 / (R * C), 1 / (L * C)]
        A = np.array([[-1 / (R * C), -1 / C], [1 / L, 0]]); u = np.array([0.0, 0.0])
    roots = np.roots(poly)
    alpha = poly[1] / 2; w0 = math.sqrt(poly[2])
    disc = alpha ** 2 - w0 ** 2
    damping = "critically_damped" if abs(disc) <= 1e-6 * w0 ** 2 else ("overdamped" if disc > 0 else "underdamped")
    r = sorted(roots, key=lambda z: (-z.real, -z.imag))
    x0 = np.array([s["vC0"], s["iL0"]])
    xss = -np.linalg.solve(A, u) if np.any(u) else np.zeros(2)
    def state(t): return xss + expm(A * t) @ (x0 - xss)
    return dict(alpha=alpha, omega0=w0, damping=damping,
                s1=[r[0].real, r[0].imag], s2=[r[1].real, r[1].imag],
                state=state)

out = []
for p in P:
    e = {k: v for k, v in p.items() if k not in ("netlist",)}
    if p["kind"] in ("dc", "first_order"):
        e["netlist"] = [list(c) for c in p["netlist"]]
    if p["kind"] == "dc": e["expected"] = dc_answers(p)
    if p["kind"] == "first_order":
        e["expected"] = first_order_answers(p); e["storage"] = list(p["storage"])
    if p["kind"] == "rlc":
        a = rlc_answers(p["rlc"])
        e["expected"] = {k: a[k] for k in ("alpha", "omega0", "damping", "s1", "s2")}
        # Waveform reference on a fixed relative grid: t_k = k/10 · (6/decay).
        decay = min(abs(complex(*a["s1"])), a["alpha"])
        grid = [k / 10 * 6 / decay for k in range(11)]
        e["expected"]["samples"] = [dict(t=t, vC=float(a["state"](t)[0]), iL=float(a["state"](t)[1])) for t in grid]
    out.append(e)

print("// GENERATED by src/test/real-problems/reference.py — do not hand-edit.")
print("// Independent reference answers (numpy MNA / closed-form τ / numpy.roots + scipy expm).")
print("export const REAL_PROBLEMS = [")
for e in out:
    print("  " + json.dumps(e, ensure_ascii=False, separators=(",", ":")) + ",")
print("] as const;")
