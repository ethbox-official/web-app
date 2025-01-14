import { Component, OnDestroy, OnInit } from '@angular/core';
import { ContractService } from '../../services/contract.service';
import { AddressBookService } from 'src/app/services/address-book.service';

@Component({
    selector: 'app-boxes-received-list',
    templateUrl: './boxes-received-list.component.html',
    styleUrls: ['./boxes-received-list.component.css']
})
export class BoxesReceivedListComponent implements OnInit, OnDestroy {

    paginatedBoxes = null;
    paginationText = '0-0 / 0';
    
    order = 'desc';
    state;
    type;
    
    chainId;
    isChainSupported;
    selectedAccount;
    isAppReady;
    message;

    private subscriptions = [];

    private pageIndex = 0;
    private pageSize = 15;
    
    private fetchedBoxes;
    private filteredBoxes;

    private addressBookMap;
    
    constructor(
        public contractServ: ContractService,
        private addressBookServ: AddressBookService) { }

    ngOnInit() {

        // Setting up the reactive code to show some messages to the user and eventually load the boxes into the component
        [
            this.contractServ.chainId$,
            this.contractServ.isChainSupported$,
            this.contractServ.selectedAccount$,
            this.contractServ.isAppReady$,
            this.contractServ.boxInteraction$,
            this.contractServ.incomingBoxes$
        ].forEach(obs => 
            this.subscriptions.push(
                obs.subscribe(() => {

                    // Resetting the component
                    this.paginatedBoxes = null;
                    this.filteredBoxes = null;
                    this.fetchedBoxes = null;

                    // Updating local variables
                    this.chainId = this.contractServ.chainId$.getValue();
                    this.isChainSupported = this.contractServ.isChainSupported$.getValue();
                    this.selectedAccount = this.contractServ.selectedAccount$.getValue();
                    this.isAppReady = this.contractServ.isAppReady$.getValue();

                    // Calculating a message for the user
                    if (!this.chainId || !this.selectedAccount) {
                        this.message = 'Please connect your wallet first!';
                        return;
                    }
                    if (!this.isChainSupported) {
                        this.message = 'Wrong network – Please use Ethereum, BSC or Polygon!';
                        return;
                    }
                    if (!this.isAppReady) {
                        this.message = 'Initializing ethbox smart contract...';
                        return;
                    }

                    this.message = 'Loading...';

                    // Get boxes and the address book
                    let boxes = this.contractServ.incomingBoxes$.getValue();
                    this.addressBookMap = this.addressBookServ.getAddressesMap();

                    if (!boxes) {
                        return;
                    }

                    if (boxes.length === 0) {
                        this.message = 'No incoming transactions!';
                        return;
                    }

                    this.fetchedBoxes = boxes
                        .map(box => ({
                            addressBookName: this.addressBookMap[box.sender],
                            ...box
                        }));
                    
                    this.filterBoxes();
                })));
    }

    ngOnDestroy() {

        // When the component gets destroyed unsubscribe from everything to prevent memory leaks
        this.subscriptions.forEach(s => s.unsubscribe());
    }

    onPaginationPreviousClick() {

        if (this.pageIndex < 1) {
            return;
        }
        this.pageIndex--;
        this.updatePagination();
    }

    onPaginationNextClick() {

        if (this.pageIndex * this.pageSize + this.pageSize > this.filteredBoxes.length - 1) {
            return;
        }
        this.pageIndex++;
        this.updatePagination();
    }

    async updatePagination() {

        let start = this.pageIndex * this.pageSize,
            end = this.pageIndex * this.pageSize + this.pageSize;
        if (end > this.filteredBoxes.length) {
            end = this.filteredBoxes.length;
        }
        this.paginationText = `${start + 1}-${end} / ${this.filteredBoxes.length}`;
        let boxesInView = this.filteredBoxes.slice(start, end);
        
        // Remove "Loading..." message
        this.message = null;

        this.paginatedBoxes = boxesInView;
    }

    filterBoxes() {

        if (!this.fetchedBoxes) {
            return;
        }

        // Should I move the predicates below into contract.service.ts?
        this.filteredBoxes = this.fetchedBoxes
            .filter(box => {
                let isTaken = box.taken && box.taken == true;
                switch(this.state) {
                    case "pending":
                        return !isTaken;
                    case "completed":
                        return isTaken;
                    default:
                        return true;
                }
            })
            .filter(box => {
                let isExchange = box.requestValue && box.requestValue != "0";
                let isWithdraw = !box.requestValue || box.requestValue == "0";
                switch(this.type) {
                    case "withdraw":
                        return isWithdraw;
                    case "exchange":
                        return isExchange;
                    default:
                        return true;
                }
            });

        if (this.order) {
            this.filteredBoxes.sort((a, b) =>
                this.order == 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp);
        }

        this.pageIndex = 0;
        this.updatePagination();
    }

    // This piece of code tells Angular how to track boxes efficiently
    // when and where to touch the DOM
    boxId(index, box) {
        return  `${box.sender}-${box.recipient}-${box.taken}-${box.timestamp}`;
    }
}
